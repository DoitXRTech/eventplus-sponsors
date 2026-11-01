// Foco de teclado y fotos del DOM para el inspector de la taste skill. Solo lee: no escribe datos.
// Por cada vista (equipo y portal) recorre con Tab y cuenta los controles enfocados sin indicador
// visible (anillo nativo del navegador, outline >= 2 px no transparente o box-shadow), y guarda el DOM renderizado sin scripts
// en dist/_snap/<vista>.html para correr inspect.mjs contra el preview.
//   APP_URL=http://localhost:4173/ PLAYWRIGHT_DIR=... node scripts/qa/visual-qa-focus-snap.cjs
const path = require('path');
const fs = require('fs');
if (process.env.PLAYWRIGHT_DIR) module.paths.unshift(process.env.PLAYWRIGHT_DIR);
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const creds = fs.readFileSync(path.join(ROOT, '.demo-credentials'), 'utf8');
const PASS = process.env.DEMO_PASSWORD || creds.split('\n')[0].split(': ').slice(1).join(': ').trim();
const BASE = process.env.APP_URL || 'http://localhost:4173/';
const SNAP = path.join(ROOT, 'dist', '_snap');
fs.mkdirSync(SNAP, { recursive: true });
const BC = '00000000-0000-4000-8000-000000000101';
const TEAM = ['dashboard', 'pipeline', 'sponsors', 'approvals', 'settings', `sponsor/${BC}/overview`, `sponsor/${BC}/comments`, `sponsor/${BC}/attendees`];

async function focusAudit(page) {
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  const bad = new Set(); let seen = 0;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const ow = parseFloat(s.outlineWidth) || 0;
      const transparent = /rgba\(\d+, \d+, \d+, 0\)|transparent/.test(s.outlineColor);
      const ok = s.outlineStyle === 'auto' || (s.outlineStyle !== 'none' && ow >= 2 && !transparent) || (s.boxShadow && s.boxShadow !== 'none');
      return { ok, label: `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 24)}"` };
    });
    if (!r) continue; seen++;
    if (!r.ok) bad.add(r.label);
  }
  return { seen, bad: [...bad] };
}

async function snap(page, name) {
  const html = await page.evaluate(() => {
    const d = document.documentElement.cloneNode(true);
    d.querySelectorAll('script').forEach((s) => s.remove());
    return '<!doctype html>' + d.outerHTML;
  });
  fs.writeFileSync(path.join(SNAP, name + '.html'), html);
}

async function login(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', PASS);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  const out = [];
  {
    const { ctx, page } = await login(browser, 'juanga@startco.example');
    for (const v of TEAM) {
      await page.goto(BASE + '#/' + v); await page.waitForTimeout(1800);
      const name = 'team-' + v.replace(`sponsor/${BC}/`, 'ficha-');
      await snap(page, name);
      out.push({ name, ...(await focusAudit(page)) });
    }
    await ctx.close();
  }
  {
    const { ctx, page } = await login(browser, 'bc@sponsor.example');
    await snap(page, 'portal');
    out.push({ name: 'portal', ...(await focusAudit(page)) });
    await ctx.close();
  }
  await browser.close();
  for (const r of out) console.log(`${r.name.padEnd(22)} foco: ${r.seen} pasos, sin indicador=${r.bad.length} ${r.bad.slice(0, 6).join('; ')}`);
})().catch((e) => { console.error('CRASH', e.message.split('\n')[0]); process.exit(1); });
