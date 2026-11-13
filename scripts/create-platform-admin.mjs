#!/usr/bin/env node
// Crea (o reusa) un usuario y lo suma a platform_admins -- el rol que ve/crea organizaciones
// pero no pertenece a ninguna (no tiene fila en profiles). Pensado para el primer admin:
// una vez que existe al menos uno, los siguientes se pueden agregar desde la app (Edge
// Function admin-console), sin volver a correr este script.
// Corre en una maquina de confianza, nunca en el navegador: usa la llave secreta.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_PASSWORD=... node scripts/create-platform-admin.mjs <email> ["Nombre completo"]
import { randomBytes } from 'node:crypto';

const [, , email, fullName] = process.argv;
if (!email) { console.error('Uso: node scripts/create-platform-admin.mjs <email> ["Nombre completo"]'); process.exit(2); }

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
if (!URL_ || !KEY) { console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY'); process.exit(2); }
const H = { apikey: KEY, 'Content-Type': 'application/json' };
if (KEY.split('.').length === 3) H.Authorization = `Bearer ${KEY}`;
const PASSWORD = process.env.DEMO_PASSWORD || randomBytes(9).toString('base64url');

async function call(method, path, body) {
  const r = await fetch(URL_ + path, { method, headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const users = await call('GET', `/auth/v1/admin/users?page=1&per_page=200`);
  let user = users.users.find((u) => u.email === email);
  if (user) {
    await call('PUT', `/auth/v1/admin/users/${user.id}`, { password: PASSWORD, email_confirm: true });
    console.log(`Usuario ya existía (${email}), clave actualizada.`);
  } else {
    user = await call('POST', '/auth/v1/admin/users', { email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName || email } });
    console.log(`Usuario creado: ${email}`);
  }
  await call('POST', '/rest/v1/platform_admins?on_conflict=user_id', [{ user_id: user.id }]);
  console.log(`Listo. Admin de plataforma: ${email} / ${PASSWORD}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
