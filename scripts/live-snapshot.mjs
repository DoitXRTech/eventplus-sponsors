// Foto y restauracion de los datos del proyecto real, para correr pruebas que escriben
// (rls-check, e2e-live) sin dejar el demo sucio y sin necesitar SUPABASE_DB_URL.
//   node scripts/live-snapshot.mjs save      -> .live-snapshot.json (fuera de git)
//   node scripts/live-snapshot.mjs restore   -> vuelve tablas y bucket a la foto
// Restaurar: borra filas y archivos nuevos, re-escribe las filas de la foto y borra la
// actividad que generan los triggers durante la restauracion. Usa la secret key.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV = process.env.SUPABASE_ENV_FILE || path.join(process.env.HOME, 'jarvis-workspace/tools/supabase/.supabase.env');
if (fs.existsSync(ENV)) {
  for (const line of fs.readFileSync(ENV, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!BASE || !KEY) { console.error('Faltan SUPABASE_URL o la secret key'); process.exit(3); }
const H = { apikey: KEY, 'Content-Type': 'application/json' };
if (KEY.split('.').length === 3) H.Authorization = `Bearer ${KEY}`;
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.live-snapshot.json');
const BUCKET = 'sponsor-files';

// Orden de dependencias (padres primero). Clave primaria de cada tabla.
const TABLES = [
  ['events', 'id'], ['sponsors', 'id'], ['profiles', 'id'], ['assets', 'id'],
  ['sponsored_startups', 'id'], ['attendees', 'id'], ['comments', 'id'], ['documents', 'id'],
  ['proposals', 'id'], ['commitment_status', 'sponsor_id,commitment_key'], ['activity', 'id'], ['prospects', 'id'],
];

async function req(method, p, body, extra = {}) {
  const r = await fetch(BASE + p, { method, headers: { ...H, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p.split('?')[0]} -> ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const rows = (t) => req('GET', `/rest/v1/${t}?select=*&limit=10000`);
const keyOf = (pk, row) => pk.split(',').map((k) => row[k]).join('|');
const filterFor = (pk, row) => pk.split(',').map((k) => `${k}=eq.${encodeURIComponent(row[k])}`).join('&');

async function listObjects(prefix = '') {
  const out = [];
  const items = await req('POST', `/storage/v1/object/list/${BUCKET}`, { prefix, limit: 1000, offset: 0 });
  for (const it of items) {
    const full = prefix ? `${prefix}/${it.name}` : it.name;
    if (it.id === null) out.push(...(await listObjects(full))); else out.push(full);
  }
  return out;
}

// Una foto con tablas faltantes o con el nucleo vacio haria que restore borre todo el demo.
const CORE = ['events', 'sponsors', 'profiles'];
const sane = (snap) => TABLES.every(([t]) => Array.isArray(snap.tables?.[t])) && CORE.every((t) => snap.tables[t].length > 0);

async function save() {
  const snap = { at: new Date().toISOString(), tables: {}, objects: await listObjects() };
  for (const [t] of TABLES) snap.tables[t] = await rows(t);
  if (!sane(snap)) { console.error('foto rechazada: faltan tablas o events/sponsors/profiles vienen vacias'); process.exit(1); }
  fs.writeFileSync(FILE, JSON.stringify(snap), { mode: 0o600 });
  console.log(`foto: ${Object.entries(snap.tables).map(([t, r]) => `${t}=${r.length}`).join(' ')} archivos=${snap.objects.length}`);
}

async function restore() {
  const snap = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!sane(snap)) { console.error('foto invalida (tablas faltantes o nucleo vacio): no se restaura nada'); process.exit(1); }
  let removed = 0, rewritten = 0;
  // 1. filas nuevas fuera (hijos primero)
  for (const [t, pk] of [...TABLES].reverse()) {
    if (t === 'activity') continue;
    const before = new Set(snap.tables[t].map((r) => keyOf(pk, r)));
    for (const r of await rows(t)) {
      if (!before.has(keyOf(pk, r))) { await req('DELETE', `/rest/v1/${t}?${filterFor(pk, r)}`); removed++; }
    }
  }
  // 2. filas de la foto de vuelta: las que faltan se insertan, las cambiadas se parchan una
  //    por una (un upsert masivo dispara los triggers de cupo de insert aun sobre filas
  //    existentes). Dos pasadas: la segunda deja stage_changed_at como estaba, porque el
  //    trigger lo pisa con now() cuando cambia la etapa.
  for (let pass = 0; pass < 2; pass++) {
    for (const [t, pk] of TABLES) {
      if (t === 'activity') continue;
      const now = new Map((await rows(t)).map((r) => [keyOf(pk, r), r]));
      for (const r of snap.tables[t]) {
        const cur = now.get(keyOf(pk, r));
        if (!cur) { await req('POST', `/rest/v1/${t}`, r, { Prefer: 'return=minimal' }); rewritten++; }
        else if (JSON.stringify(cur) !== JSON.stringify(r)) {
          const patch = Object.fromEntries(Object.entries(r).filter(([k, v]) => JSON.stringify(cur[k]) !== JSON.stringify(v)));
          await req('PATCH', `/rest/v1/${t}?${filterFor(pk, r)}`, patch, { Prefer: 'return=minimal' });
          rewritten++;
        }
      }
    }
  }
  // 3. actividad: lo que no estaba en la foto (pruebas + triggers de la restauracion) fuera;
  //    lo que estaba y se borro, de vuelta (activity.id es identity: solo se re-crea si falta).
  const actBefore = new Set(snap.tables.activity.map((r) => r.id));
  for (const r of await rows('activity')) if (!actBefore.has(r.id)) { await req('DELETE', `/rest/v1/activity?id=eq.${r.id}`); removed++; }
  const actNow = new Set((await rows('activity')).map((r) => r.id));
  const missing = snap.tables.activity.filter((r) => !actNow.has(r.id));
  if (missing.length) console.log(`aviso: ${missing.length} filas de actividad borradas no se pueden re-crear con su id (identity)`);
  // 4. archivos nuevos fuera
  const objBefore = new Set(snap.objects);
  const extra = (await listObjects()).filter((o) => !objBefore.has(o));
  if (extra.length) await req('DELETE', `/storage/v1/object/${BUCKET}`, { prefixes: extra });
  // 5. comprobar: cada tabla igual a la foto
  const diffs = [];
  for (const [t, pk] of TABLES) {
    const now = await rows(t);
    const a = JSON.stringify(snap.tables[t].map((r) => keyOf(pk, r)).sort());
    const b = JSON.stringify(now.map((r) => keyOf(pk, r)).sort());
    if (a !== b) diffs.push(`${t}: claves distintas`);
    else if (t !== 'activity') {
      const byKey = new Map(now.map((r) => [keyOf(pk, r), JSON.stringify(r)]));
      const changed = snap.tables[t].filter((r) => byKey.get(keyOf(pk, r)) !== JSON.stringify(r)).length;
      if (changed) diffs.push(`${t}: ${changed} filas con valores distintos`);
    }
  }
  const objNow = await listObjects();
  const missingObj = snap.objects.filter((o) => !objNow.includes(o));
  if (missingObj.length) diffs.push(`archivos que faltan: ${missingObj.length}`);
  console.log(`restaurado: ${removed} filas/actividad nuevas borradas, ${rewritten} restauradas, ${extra.length} archivos nuevos borrados`);
  if (diffs.length) { console.log('DIFERENCIAS: ' + diffs.join('; ')); process.exit(1); }
  console.log('igual a la foto');
}

const cmd = process.argv[2];
if (cmd === 'save') await save();
else if (cmd === 'restore') await restore();
else { console.error('uso: live-snapshot.mjs save|restore'); process.exit(2); }
