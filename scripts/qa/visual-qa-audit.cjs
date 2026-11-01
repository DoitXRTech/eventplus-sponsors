// Auditoria de UI sobre el render (guias del KB: Estructura de Producto y Diseno Visual):
// por cada vista del equipo y del portal, a 1280 y 390 px, mide botones primarios visibles,
// desborde horizontal, inputs con fuente < 16 px en mobile (iOS hace zoom), destinos tactiles
// chicos y errores de la pagina, y guarda un screenshot. Solo lee: no escribe datos.
//   APP_URL=https://sponsors-demo.vercel.app/ PLAYWRIGHT_DIR=... node scripts/qa/visual-qa-audit.cjs [outDir]
const path = require('path');
const fs = require('fs');
if (process.env.PLAYWRIGHT_DIR) module.paths.unshift(process.env.PLAYWRIGHT_DIR);
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const creds = fs.readFileSync(path.join(ROOT, '.demo-credentials'), 'utf8');
const PASS = process.env.DEMO_PASSWORD || creds.split('\n')[0].split(': ').slice(1).join(': ').trim();
const BASE = process.env.APP_URL || 'https://sponsors-demo.vercel.app/';
const OUT = process.argv[2] || path.join(process.env.HOME, 'jarvis-workspace/.visual-qa-out/sponsors-demo');
fs.mkdirSync(OUT, { recursive: true });
const BC = '00000000-0000-4000-8000-000000000101';
const TEAM_VIEWS = ['dashboard', 'pipeline', 'sponsors', 'approvals', 'settings',
  ...['overview', 'comments', 'assets', 'attendees', 'contract', 'proposal', 'commitments', 'legal', 'post'].map((t) => `sponsor/${BC}/${t}`)];

const measure = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const main = document.querySelector('main') || document.body;
  const primaries = [...main.querySelectorAll('button.accent-bg, a.accent-bg')].filter(vis);
  const small = [...document.querySelectorAll('button, a[href], input[type=checkbox], select')].filter(vis)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 24 || r.height < 24)
    .map(({ el, r }) => `${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  const tinyInputs = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea')].filter(vis)
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length;
  return {
    primary: primaries.length,
    primaryAboveFold: primaries.filter(inView).length,
    primaryLabels: primaries.map((b) => b.textContent.trim().slice(0, 28)),
    hScroll: document.documentElement.scrollWidth > innerWidth + 1,
    small: small.slice(0, 6), smallCount: small.length, tinyInputs,
    h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 40),
  };
};

async function session(browser, email, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text().slice(0, 140)); });
  await page.goto(BASE);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', PASS);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  const report = [];
  // login (sin sesion)
  for (const w of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(BASE); await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, `login-${w}.png`) });
    report.push({ who: 'anon', view: 'login', w, ...(await page.evaluate(measure)) });
    await ctx.close();
  }
  for (const w of [1280, 390]) {
    const { ctx, page } = await session(browser, 'juanga@startco.example', w);
    for (const v of TEAM_VIEWS) {
      await page.goto(BASE + '#/' + v); await page.waitForTimeout(1800);
      const name = v.replace(`sponsor/${BC}/`, 'ficha-');
      await page.screenshot({ path: path.join(OUT, `team-${name}-${w}.png`), fullPage: w < 600 ? false : true });
      report.push({ who: 'team', view: name, w, ...(await page.evaluate(measure)) });
    }
    report.push({ who: 'team', view: '(errores)', w, errors: page.errors });
    await ctx.close();
  }
  for (const w of [1280, 390, 320]) {
    const { ctx, page } = await session(browser, 'bc@sponsor.example', w);
    await page.screenshot({ path: path.join(OUT, `portal-${w}.png`), fullPage: true });
    report.push({ who: 'sponsor', view: 'portal', w, ...(await page.evaluate(measure)), errors: page.errors });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 1));
  for (const r of report) {
    if (r.errors && !r.view.startsWith('portal') && r.view === '(errores)') { console.log(`${r.who} ${r.w} errores: ${r.errors.length ? r.errors.join(' | ') : 'ninguno'}`); continue; }
    console.log(`${r.who.padEnd(7)} ${r.view.padEnd(18)} ${String(r.w).padStart(4)}  prim=${r.primary} (fold ${r.primaryAboveFold}) [${r.primaryLabels.join(', ')}]  hscroll=${r.hScroll}  inputs<16=${r.tinyInputs}  tactil<24=${r.smallCount} ${r.small.join('; ')}${r.errors ? '  errores=' + r.errors.length : ''}`);
  }
})().catch((e) => { console.error('CRASH', e.message.split('\n')[0]); process.exit(1); });
