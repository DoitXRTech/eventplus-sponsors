// E2E de las acciones de escritura contra el stack LOCAL (local/README.md). Escribe datos:
// correrlo solo contra sponsors_local y re-sembrar despues. Uso: node local/e2e.cjs
// Requiere Playwright (PLAYWRIGHT_DIR apunta a un node_modules que lo tenga) y psql.
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
if (process.env.PLAYWRIGHT_DIR) module.paths.unshift(process.env.PLAYWRIGHT_DIR);
const { chromium } = require('playwright');
const creds = fs.readFileSync(path.join(__dirname, '..', '.demo-credentials'), 'utf8');
const PASS = process.env.DEMO_PASSWORD || creds.split('\n')[0].split(': ').slice(1).join(': ').trim();
const BASE = process.env.APP_URL || 'http://localhost:5173/';
const DB = process.env.LOCAL_DB || 'sponsors_local';
const BC = '00000000-0000-4000-8000-000000000101';
const sql = (q) => execSync(`psql -h /tmp -d ${DB} -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };
async function login(browser, email, w = 1280) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', PASS);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  return { ctx, page };
}
const toast = async (page) => { await page.waitForTimeout(1200); return (await page.locator('[role=status]').allInnerTexts()).join(' | '); };
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
  const nid = sql("select id from sponsors where name='Nutresa QA'");
  check('crear patrocinador', Boolean(nid) && page.url().includes(nid), sql(`select tier||' '||value_cop||' '||initials from sponsors where id='${nid}'`));
  await page.getByRole('button', { name: /Avanzar a Contrato/ }).click();
  check('avanzar etapa', (await toast(page)).includes('Contrato') && sql(`select stage from sponsors where id='${nid}'`) === 'contract');
  check('actividad de etapa (trigger)', sql(`select count(*) from activity where sponsor_id='${nid}' and kind='stage'`) === '1');
  // conversacion + nota interna
  await page.goto(BASE + `#/sponsor/${BC}/comments`); await page.waitForTimeout(1500);
  await page.getByLabel('Mensaje', { exact: true }).fill('Mensaje QA del equipo');
  await page.getByRole('button', { name: 'Enviar' }).click();
  check('mensaje equipo', (await toast(page)).includes('Mensaje enviado'));
  await page.getByLabel('Mensaje', { exact: true }).fill('Nota interna QA secreta');
  await page.getByLabel(/Nota interna/).check();
  await page.getByRole('button', { name: 'Enviar' }).click();
  check('nota interna', (await toast(page)).includes('Nota interna') && sql("select internal from comments where body='Nota interna QA secreta'") === 't');
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
  check('CSV: día y nombre con coma', sql("select name||'|'||day from attendees where email='luis.qa@bc.example'") === 'Pérez, Luis|d1');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar' }).click()]);
  const out = fs.readFileSync(await dl.path(), 'utf8');
  check('exportar CSV con formula neutralizada', out.includes("'=cmd") && out.includes('"Pérez, Luis"'));
  // compromisos
  await page.goto(BASE + `#/sponsor/${BC}/commitments`); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Valla de agradecimiento/ }).click();
  check('compromiso cumplido', (await toast(page)).includes('cumplido') && sql(`select done from commitment_status where sponsor_id='${BC}' and commitment_key='valla-de-agradecimiento'`) === 't');
  // contrato del nuevo
  await page.goto(BASE + `#/sponsor/${nid}/contract`); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Marcar como firmado' }).click();
  await toast(page);
  check('contrato firmado con fecha', sql(`select contract_status||' '||(contract_signed_at is not null) from sponsors where id='${nid}'`) === 'Firmado true');
  // propuesta sin archivo
  await page.goto(BASE + `#/sponsor/${nid}/proposal`); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Nueva versión' }).click();
  await page.getByLabel('Qué cambia en esta versión').fill('Primera propuesta QA');
  await page.getByRole('button', { name: 'Enviar al cliente' }).click();
  check('propuesta v1', (await toast(page)).includes('v1') && sql(`select version||status from proposals where sponsor_id='${nid}'`) === '1enviada');
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
  check('datos legales', (await toast(page)).includes('guardados') && sql(`select legal_razon from sponsors where id='${nid}'`) === 'Grupo Nutresa S.A.');
  // post
  await page.goto(BASE + `#/sponsor/${nid}/post`); await page.waitForTimeout(1500);
  await page.getByLabel('NPS (0 a 10)').fill('11');
  await page.getByRole('button', { name: 'Guardar' }).first().click();
  check('NPS invalido frenado', (await toast(page)).includes('0 a 10'));
  await page.getByLabel('NPS (0 a 10)').fill('9.5');
  await page.getByRole('button', { name: 'Guardar' }).first().click();
  check('NPS guardado', sql(`select nps from sponsors where id='${nid}'`).startsWith('9.5'));
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
  check('equipo sin errores JS', page.errors.length === 0, page.errors.join(';'));
  await ctx.close();

  // ---------- patrocinador ----------
  ({ ctx, page } = await login(browser, 'bc@sponsor.example', 390));
  const body = await page.locator('body').innerText();
  check('cliente no ve nota interna', !body.includes('Nota interna QA secreta'));
  check('cliente ve mensaje del equipo', body.includes('Mensaje QA del equipo'));
  check('cliente no ve piezas en produccion de otros', !body.includes('Valla QA'));
  const pend = sql(`select string_agg(name, '|' order by sent_at) from assets where sponsor_id='${BC}' and status='pendiente'`).split('|');
  const card = (n) => page.locator('#aprobaciones > div > div').filter({ hasText: n });
  await card(pend[0]).getByRole('button', { name: 'Aprobar' }).click();
  check('cliente aprueba pieza', (await toast(page)).includes('Aprobaste') && sql(`select status from assets where name='${pend[0]}' and sponsor_id='${BC}'`) === 'aprobado');
  await card(pend[1]).getByRole('button', { name: 'Pedir cambios' }).click();
  await page.getByLabel('Qué hay que cambiar').fill('Logo más grande, por favor');
  await page.getByRole('button', { name: 'Enviar cambios' }).click();
  check('cliente pide cambios', (await toast(page)).includes('cambios') && sql(`select status||'|'||review_note from assets where name='${pend[1]}' and sponsor_id='${BC}'`) === 'cambios|Logo más grande, por favor');
  check('comentario automatico de la revision', sql(`select count(*) from comments where sponsor_id='${BC}' and body like 'Pido cambios: Logo%'`) === '1');
  // startups: lleno -> quitar una y agregar
  const firstStartup = sql(`select name from sponsored_startups where sponsor_id='${BC}' order by created_at limit 1`);
  await page.getByRole('button', { name: `Quitar ${firstStartup}` }).click();
  await toast(page);
  await page.getByLabel('Nombre de la startup').fill('Startup QA');
  await page.getByRole('button', { name: 'Agregar', exact: true }).last().click();
  check('cliente cambia apadrinada', (await toast(page)).includes('apadrinada') && sql(`select count(*) from sponsored_startups where sponsor_id='${BC}'`) === '5');
  await page.getByLabel('Mensaje', { exact: true }).fill('Mensaje QA del cliente');
  await page.getByRole('button', { name: 'Enviar' }).click();
  check('cliente escribe', (await toast(page)).includes('Mensaje enviado') && sql("select team from comments where body='Mensaje QA del cliente'") === 'sponsor');
  // el cliente intenta ver otro patrocinio por hash: el portal siempre es el suyo
  await page.goto(BASE + '#/sponsor/00000000-0000-4000-8000-000000000102'); await page.waitForTimeout(1500);
  check('hash ajeno no cambia de portal', (await page.locator('header').innerText()).includes('Bancolombia'));
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
