#!/usr/bin/env node
// Crea los usuarios demo (equipo StartCo + un contacto por patrocinador) y sus perfiles.
// Corre en una maquina de confianza, nunca en el navegador: usa la llave secreta.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-users.mjs
// Idempotente: si el usuario ya existe, le pone la clave nueva y actualiza su perfil.
// Escribe las credenciales en .demo-credentials (fuera de git) y no las imprime.
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { TEAM, SPONSORS } from './seed-data.mjs';

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!URL_ || !KEY) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const H = { apikey: KEY, 'Content-Type': 'application/json' };
// Las llaves nuevas (sb_secret_) no son JWT: van solo en apikey. Las viejas (JWT) tambien en Authorization.
if (KEY.split('.').length === 3) H.Authorization = `Bearer ${KEY}`;

async function call(method, path, body) {
  const r = await fetch(URL_ + path, { method, headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function listUsers() {
  const all = [];
  for (let page = 1; ; page++) {
    const res = await call('GET', `/auth/v1/admin/users?page=${page}&per_page=200`);
    all.push(...res.users);
    if (res.users.length < 200) return all;
  }
}

const password = process.env.DEMO_PASSWORD || `Demo-${randomBytes(6).toString('base64url')}`;
const people = [
  ...TEAM.map((t) => ({ email: t.email, full_name: t.full_name, title: t.title, kind: 'team', sponsor_id: null })),
  ...SPONSORS.map((s) => ({
    email: `${s.initials.toLowerCase()}@sponsor.example`, full_name: s.contact.name, title: s.contact.role,
    kind: 'sponsor', sponsor_id: s.id, sponsor: s.name,
  })),
];

const existing = new Map((await listUsers()).map((u) => [u.email, u]));
const lines = [`Clave de todos los usuarios demo: ${password}`, ''];
for (const p of people) {
  let user = existing.get(p.email);
  if (user) {
    await call('PUT', `/auth/v1/admin/users/${user.id}`, { password, email_confirm: true });
  } else {
    user = await call('POST', '/auth/v1/admin/users', { email: p.email, password, email_confirm: true, user_metadata: { full_name: p.full_name } });
  }
  await call('POST', '/rest/v1/profiles?on_conflict=id', [{ id: user.id, full_name: p.full_name, title: p.title, kind: p.kind, sponsor_id: p.sponsor_id }]);
  lines.push(`${p.kind === 'team' ? 'Equipo    ' : 'Patrocinio'}  ${p.email.padEnd(28)} ${p.sponsor ? p.sponsor + ' · ' : ''}${p.full_name}`);
}
writeFileSync('.demo-credentials', lines.join('\n') + '\n', { mode: 0o600 });
console.log(`${people.length} usuarios listos (${TEAM.length} del equipo, ${SPONSORS.length} patrocinadores). Credenciales en .demo-credentials`);
