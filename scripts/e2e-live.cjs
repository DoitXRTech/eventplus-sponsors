// E2E de las acciones de escritura contra el proyecto REAL (o el deploy), con Playwright.
// Escribe datos: correrlo siempre entre una foto y su restauracion:
//   node scripts/live-snapshot.mjs save && APP_URL=https://... node scripts/e2e-live.cjs; node scripts/live-snapshot.mjs restore
// Es la version en vivo de local/e2e.cjs: mismas acciones, las comprobaciones leen la base por la
// API REST con la secret key (no hay psql contra el proyecto real). Requiere PLAYWRIGHT_DIR.
const path = require('path');
const fs = require('fs');
if (process.env.PLAYWRIGHT_DIR) module.paths.unshift(process.env.PLAYWRIGHT_DIR);
const { chromium } = require('playwright');
const ENV = process.env.SUPABASE_ENV_FILE || path.join(process.env.HOME, 'jarvis-workspace/tools/supabase/.supabase.env');
if (fs.existsSync(ENV)) for (const line of fs.readFileSync(ENV, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const creds = fs.readFileSync(path.join(__dirname, '..', '.demo-credentials'), 'utf8');
const PASS = process.env.DEMO_PASSWORD || creds.split('\n')[0].split(': ').slice(1).join(': ').trim();
const BASE = process.env.APP_URL || 'https://sponsors-demo.vercel.app/';
const BC = '00000000-0000-4000-8000-000000000101';
const H = { apikey: KEY, 'Content-Type': 'application/json' };
// rows('sponsors', 'name=eq.X&select=id') -> filas, con la secret key (salta RLS: es el verificador)
const rows = async (table, q) => {
  const r = await fetch(`${SB}/rest/v1/${table}?${q}`, { headers: H });
  if (!r.ok) throw new Error(`REST ${table} ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r.json();
};
const one = async (table, q) => (await rows(table, q))[0] || {};
const objects = async (prefix) => {
  const r = await fetch(`${SB}/storage/v1/object/list/sponsor-files`, { method: 'POST', headers: H, body: JSON.stringify({ prefix, limit: 100 }) });
  return (await r.json()).filter((o) => o.id);
};
const enc = encodeURIComponent;
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };
async function login(browser, email, w = 1280) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  // El inscrito duplicado es a proposito (409/23505, la app lo muestra como aviso): no cuenta.
  page.on('console', (m) => { if (m.type() === 'error' && !/409|23505/.test(m.text())) page.errors.push('console: ' + m.text().slice(0, 160)); });
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', PASS);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  return { ctx, page };
}
const toast = async (page) => { await page.waitForTimeout(1200); return (await page.locator('[role=status]').allInnerTexts()).join(' | '); };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const pick = async (page, button, file) => {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
  await fc.setFiles(file);
};
// Abre la descarga firmada (ventana nueva), captura la URL pedida y baja su contenido.
// (Chromium headless trata el PDF como descarga: la ventana no navega, por eso se mira el request.)
const download = async (page, button) => {
  const [pop] = await Promise.all([page.context().waitForEvent('page'), button.click()]);
  const req = await pop.waitForRequest(/\/object\/sign\//, { timeout: 8000 }).catch(() => null);
  const url = req ? req.url() : pop.url();
  const text = req ? await (await page.request.get(url)).text() : '';
  await pop.close();
  return { url, text };
};
(async () => {
  const browser = await chromium.launch();
  // ---------- equipo ----------
  let { ctx, page } = await login(browser, 'juanga@startco.example');
  await page.goto(BASE + '#/sponsors'); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Nuevo' }).click();
  await page.getByLabel('Nombre').fill('Nutresa QA');
  await page.getByLabel('Paquete').selectOption('Seed');
  await page.getByLabel('Email').fill('qa@nutresa.example');
  await page.getByRole('button', { name: 'Crear patrocinador' }).click();
  await page.waitForTimeout(2000);
  const ns = await one('sponsors', 'name=eq.Nutresa%20QA&select=id,tier,value_cop,initials');
  const nid = ns.id;
  check('crear patrocinador', Boolean(nid) && page.url().includes(nid), `${ns.tier} ${ns.value_cop} ${ns.initials}`);
  await page.getByRole('button', { name: /Avanzar a Contrato/ }).click();
  check('avanzar etapa', (await toast(page)).includes('Contrato') && (await one('sponsors', `id=eq.${nid}&select=stage`)).stage === 'contract');
  check('actividad de etapa (trigger)', (await rows('activity', `sponsor_id=eq.${nid}&kind=eq.stage&select=id`)).length === 1);
  // conversacion + nota interna
  await page.goto(BASE + `#/sponsor/${BC}/comments`); await page.waitForTimeout(1500);
  await page.getByLabel('Mensaje', { exact: true }).fill('Mensaje QA del equipo');
  await page.getByRole('button', { name: 'Enviar' }).click();
  check('mensaje equipo', (await toast(page)).includes('Mensaje enviado'));
  await page.getByLabel('Mensaje', { exact: true }).fill('Nota interna QA secreta');
  await page.getByLabel(/Nota interna/).check();
  await page.getByRole('button', { name: 'Enviar' }).click();
  check('nota interna', (await toast(page)).includes('Nota interna') && (await one('comments', `body=eq.${enc('Nota interna QA secreta')}&select=internal`)).internal === true);
  // inscritos: manual + CSV
  await page.goto(BASE + `#/sponsor/${BC}/attendees`); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Agregar', exact: true }).first().click();
  await page.getByRole('dialog').getByLabel('Nombre').fill('Ana QA');
  await page.getByRole('dialog').getByLabel('Email').fill('ana.qa@bc.example');
  await page.getByRole('dialog').getByRole('button', { name: 'Agregar' }).click();
  check('agregar inscrito', (await toast(page)).includes('Inscripción agregada'));
  await page.getByRole('button', { name: 'Agregar', exact: true }).first().click();
  await page.getByRole('dialog').getByLabel('Nombre').fill('Ana QA dup');
  await page.getByRole('dialog').getByLabel('Email').fill('ana.qa@bc.example');
  await page.getByRole('dialog').getByRole('button', { name: 'Agregar' }).click();
  check('inscrito duplicado da error humano', (await toast(page)).includes('ya está inscrita'));
  await page.keyboard.press('Escape');
  const csv = 'nombre;correo;cargo;día\n"Pérez, Luis";luis.qa@bc.example;CTO;día 1\nSin Email;;x;\nAna repetida;ana.qa@bc.example;;\n=cmd;cmd.qa@bc.example;;ambos\n';
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Importar CSV' }).click()]);
  await fc.setFiles({ name: 'inscritos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const t = await toast(page);
  check('importar CSV', /2 inscritos.*1 ya estaban.*1 sin nombre/.test(t), t);
  { const a = await one('attendees', 'email=eq.luis.qa@bc.example&select=name,day'); check('CSV: día y nombre con coma', `${a.name}|${a.day}` === 'Pérez, Luis|d1'); }
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar' }).click()]);
  const out = fs.readFileSync(await dl.path(), 'utf8');
  check('exportar CSV con formula neutralizada', out.includes("'=cmd") && out.includes('"Pérez, Luis"'));
  // compromisos
  await page.goto(BASE + `#/sponsor/${BC}/commitments`); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Valla de agradecimiento/ }).click();
  check('compromiso cumplido', (await toast(page)).includes('cumplido') && (await one('commitment_status', `sponsor_id=eq.${BC}&commitment_key=eq.valla-de-agradecimiento&select=done`)).done === true);
  // contrato del nuevo
  await page.goto(BASE + `#/sponsor/${nid}/contract`); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Marcar como firmado' }).click();
  await toast(page);
  { const c = await one('sponsors', `id=eq.${nid}&select=contract_status,contract_signed_at`); check('contrato firmado con fecha', c.contract_status === 'Firmado' && Boolean(c.contract_signed_at)); }
  // propuesta sin archivo
  await page.goto(BASE + `#/sponsor/${nid}/proposal`); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Nueva versión' }).click();
  await page.getByLabel('Qué cambia en esta versión').fill('Primera propuesta QA');
  await page.getByRole('button', { name: 'Enviar al cliente' }).click();
  check('propuesta v1', (await toast(page)).includes('v1') && await (async () => { const p = await rows('proposals', `sponsor_id=eq.${nid}&select=version,status`); return p.length === 1 && `${p[0].version}${p[0].status}` === '1enviada'; })());
  // pieza en produccion sin archivo, enviar sin archivo debe frenar
  await page.goto(BASE + `#/sponsor/${nid}/assets`); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Nueva pieza' }).click();
  await page.getByLabel('Nombre de la pieza').fill('Valla QA');
  await page.getByLabel(/Enviar al cliente/).uncheck();
  await page.getByRole('button', { name: 'Guardar' }).click();
  check('pieza en produccion', (await toast(page)).includes('producción'));
  await page.getByRole('button', { name: 'Enviar a aprobación' }).click();
  check('enviar sin archivo se frena', (await toast(page)).includes('Sube el archivo'));
  // legales
  await page.goto(BASE + `#/sponsor/${nid}/legal`); await page.waitForTimeout(1500);
  await page.getByLabel('Razón social').fill('Grupo Nutresa S.A.');
  await page.getByRole('button', { name: 'Guardar' }).click();
  check('datos legales', (await toast(page)).includes('guardados') && (await one('sponsors', `id=eq.${nid}&select=legal_razon`)).legal_razon === 'Grupo Nutresa S.A.');
  // post
  await page.goto(BASE + `#/sponsor/${nid}/post`); await page.waitForTimeout(1500);
  await page.getByLabel('NPS (0 a 10)').fill('11');
  await page.getByRole('button', { name: 'Guardar' }).first().click();
  check('NPS invalido frenado', (await toast(page)).includes('0 a 10'));
  await page.getByLabel('NPS (0 a 10)').fill('9.5');
  await page.getByRole('button', { name: 'Guardar' }).first().click();
  await page.waitForTimeout(1200);
  check('NPS guardado', Number((await one('sponsors', `id=eq.${nid}&select=nps`)).nps) === 9.5);
  // aprobaciones: recordar
  await page.goto(BASE + '#/approvals'); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Recordar' }).first().click();
  check('recordatorio', (await toast(page)).includes('Recordatorio'));
  // pipeline flecha
  await page.goto(BASE + '#/pipeline'); await page.waitForTimeout(1500);
  // settings
  await page.goto(BASE + '#/settings'); await page.waitForTimeout(1500);
  await page.getByLabel('Lugar').fill('Plaza Mayor Medellín');
  await page.getByRole('button', { name: 'Guardar evento' }).click();
  check('evento guardado', (await toast(page)).includes('Evento actualizado'));
  // busqueda
  await page.getByPlaceholder(/Buscar/).first().fill('bancol');
  await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  check('busqueda abre ficha', page.url().includes(BC));
  // ---------- subidas del equipo (storage local) ----------
  await page.goto(BASE + `#/sponsor/${nid}/contract`); await page.waitForTimeout(1500);
  await pick(page, page.getByRole('button', { name: 'Subir contrato' }), { name: 'Contrato Nutresa.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 contrato qa') });
  await toast(page);
  check('subir contrato', (await rows('documents', `sponsor_id=eq.${nid}&kind=eq.contrato&file_path=like.${nid}/contrato/*&select=id`)).length === 1);
  let dl2 = await download(page, page.getByRole('button', { name: 'Descargar' }).first());
  check('descargar contrato firmado', dl2.url.includes('/storage/v1/object/sign/') && dl2.text.includes('contrato qa'), dl2.url.slice(0, 60));
  await page.getByRole('button', { name: 'Borrar Contrato Nutresa.pdf' }).click();
  check('borrar documento borra su archivo', (await toast(page)).includes('Documento borrado')
    && (await rows('documents', `sponsor_id=eq.${nid}&kind=eq.contrato&select=id`)).length === 0
    && (await objects(`${nid}/contrato`)).length === 0);
  await page.goto(BASE + `#/sponsor/${nid}/assets`); await page.waitForTimeout(1500);
  await pick(page, page.getByRole('button', { name: 'Subir logo' }), { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  check('equipo sube logo', (await toast(page)).includes('Logo actualizado') && String((await one('sponsors', `id=eq.${nid}&select=logo_path`)).logo_path).startsWith(`${nid}/logo/`));
  await pick(page, page.getByRole('button', { name: 'Subir archivo' }), { name: 'valla.png', mimeType: 'image/png', buffer: PNG });
  await toast(page);
  await page.getByRole('button', { name: 'Enviar a aprobación' }).click();
  check('pieza: archivo y envio', (await toast(page)).includes('Pieza enviada') && await (async () => { const a = await one('assets', `sponsor_id=eq.${nid}&name=eq.${enc('Valla QA')}&select=status,file_path`); return a.status === 'pendiente' && String(a.file_path).startsWith(`${nid}/piezas/`); })());
  await page.getByRole('button', { name: 'Nueva pieza' }).click();
  await page.getByLabel('Nombre de la pieza').fill('Pendón QA');
  await pick(page, page.getByRole('dialog').getByRole('button', { name: 'Elegir archivo' }), { name: 'pendon.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Subir y enviar' }).click();
  check('pieza nueva con archivo', (await toast(page)).includes('aprobación') && (await one('assets', `sponsor_id=eq.${nid}&name=eq.${enc('Pendón QA')}&select=status`)).status === 'pendiente');
  check('equipo sin errores JS', page.errors.length === 0, page.errors.join(';'));
  await ctx.close();

  // ---------- patrocinador ----------
  ({ ctx, page } = await login(browser, 'bc@sponsor.example', 390));
  const body = await page.locator('body').innerText();
  check('cliente no ve nota interna', !body.includes('Nota interna QA secreta'));
  check('cliente ve mensaje del equipo', body.includes('Mensaje QA del equipo'));
  check('cliente no ve piezas en produccion de otros', !body.includes('Valla QA'));
  const pend = (await rows('assets', `sponsor_id=eq.${BC}&status=eq.pendiente&select=name&order=sent_at`)).map((a) => a.name);
  const card = (n) => page.locator('#aprobaciones > div > div').filter({ hasText: n });
  await card(pend[0]).getByRole('button', { name: 'Aprobar' }).click();
  check('cliente aprueba pieza', (await toast(page)).includes('Aprobaste') && (await one('assets', `sponsor_id=eq.${BC}&name=eq.${enc(pend[0])}&select=status`)).status === 'aprobado');
  await card(pend[1]).getByRole('button', { name: 'Pedir cambios' }).click();
  await page.getByLabel('Qué hay que cambiar').fill('Logo más grande, por favor');
  await page.getByRole('button', { name: 'Enviar cambios' }).click();
  check('cliente pide cambios', (await toast(page)).includes('cambios') && await (async () => { const a = await one('assets', `sponsor_id=eq.${BC}&name=eq.${enc(pend[1])}&select=status,review_note`); return `${a.status}|${a.review_note}` === 'cambios|Logo más grande, por favor'; })());
  check('comentario automatico de la revision', (await rows('comments', `sponsor_id=eq.${BC}&body=like.${enc('Pido cambios: Logo*')}&select=id`)).length === 1);
  // startups: lleno -> quitar una y agregar
  const firstStartup = (await one('sponsored_startups', `sponsor_id=eq.${BC}&select=name&order=created_at&limit=1`)).name;
  await page.getByRole('button', { name: `Quitar ${firstStartup}` }).click();
  await toast(page);
  await page.getByLabel('Nombre de la startup').fill('Startup QA');
  await page.getByRole('button', { name: 'Agregar', exact: true }).last().click();
  check('cliente cambia apadrinada', (await toast(page)).includes('apadrinada') && (await rows('sponsored_startups', `sponsor_id=eq.${BC}&select=id`)).length === 5);
  await page.getByLabel('Mensaje', { exact: true }).fill('Mensaje QA del cliente');
  await page.getByRole('button', { name: 'Enviar' }).click();
  check('cliente escribe', (await toast(page)).includes('Mensaje enviado') && (await one('comments', `body=eq.${enc('Mensaje QA del cliente')}&select=team`)).team === 'sponsor');
  // el cliente intenta ver otro patrocinio por hash: el portal siempre es el suyo
  await page.goto(BASE + '#/sponsor/00000000-0000-4000-8000-000000000102'); await page.waitForTimeout(1500);
  check('hash ajeno no cambia de portal', (await page.locator('header').innerText()).includes('Bancolombia'));
  // subidas del patrocinador
  await pick(page, page.getByRole('button', { name: 'Subir documento' }), { name: 'RUT Bancolombia.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 rut qa') });
  check('cliente sube documento legal', (await toast(page)).includes('quedó subido') && (await rows('documents', `sponsor_id=eq.${BC}&kind=eq.legal&file_path=like.${BC}/legal/*&select=id`)).length === 1);
  await pick(page, page.getByRole('button', { name: 'Reemplazar logo' }), { name: 'logo-bc.png', mimeType: 'image/png', buffer: PNG });
  check('cliente sube logo', (await toast(page)).includes('Logo actualizado') && String((await one('sponsors', `id=eq.${BC}&select=logo_path`)).logo_path).startsWith(`${BC}/logo/`));
  await pick(page, page.getByRole('button', { name: 'Adjuntar' }), { name: 'brief.txt', mimeType: 'text/plain', buffer: Buffer.from('brief qa adjunto') });
  await page.getByLabel('Mensaje', { exact: true }).fill('Va el brief QA');
  await page.getByRole('button', { name: 'Enviar' }).click();
  check('cliente adjunta archivo', (await toast(page)).includes('Mensaje enviado') && String((await one('comments', `body=eq.${enc('Va el brief QA')}&select=attachment_path`)).attachment_path).startsWith(`${BC}/chat/`));
  check('cliente sin errores JS', page.errors.length === 0, page.errors.join(';'));
  await ctx.close();

  // ---------- equipo ve el pedido de cambios ----------
  ({ ctx, page } = await login(browser, 'carolina@startco.example'));
  await page.goto(BASE + '#/approvals'); await page.waitForTimeout(1500);
  check('equipo ve cambios pedidos', (await page.locator('body').innerText()).includes('Logo más grande'));
  await ctx.close();
  await browser.close();
  console.log(results.join('\n'));
  if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
})().catch((e) => { console.log(results.join('\n')); console.error('CRASH', e.message.split('\n')[0]); process.exit(1); });
