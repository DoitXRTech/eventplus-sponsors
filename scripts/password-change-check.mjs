#!/usr/bin/env node
// Prueba el cambio de clave autoservicio (ChangePasswordCard, supabase.auth.updateUser) por
// el camino real. Usa un miembro de equipo de prueba creado a proposito para esto -- nunca
// la clave de un usuario demo real, porque si algo sale mal ahi se rompen todos los demas
// scripts que dependen de DEMO_PASSWORD.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... DEMO_PASSWORD=... node scripts/password-change-check.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !anon || !password) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY y/o DEMO_PASSWORD');
  process.exit(2);
}

let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${name}${extra ? ` (${extra})` : ''}`);
};
const client = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(email, pass) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password: pass });
  return { c, error };
}

const team = await (async () => {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: 'juanga@startco.example', password });
  if (error) throw new Error(`login juanga@startco.example: ${error.message}`);
  return c;
})();

const tag = `password-change-check-${Date.now()}`;
const email = `${tag}@example.com`;
const { data: created, error: createErr } = await team.functions.invoke('org-console', {
  body: { action: 'add_team_member', email, full_name: 'Password Check' },
});
check('se crea el usuario de prueba', !createErr && !created?.error && Boolean(created?.password), createErr?.message || created?.error);
if (!created?.password) process.exit(1);

const oldPassword = created.password;
const newPassword = `${oldPassword}-nuevo-1!`;

const { c: session1, error: loginErr } = await login(email, oldPassword);
check('entra con la clave original', !loginErr, loginErr?.message);

{
  const { error } = await session1.auth.updateUser({ password: newPassword });
  check('puede cambiar su propia clave', !error, error?.message);
}

{
  const { error } = await login(email, oldPassword);
  check('la clave vieja ya no sirve', !!error, error?.message || 'sin error (mal)');
}
{
  const { error } = await login(email, newPassword);
  check('la clave nueva sí sirve', !error, error?.message);
}

console.log(failed ? `\n${failed} pruebas fallaron` : '\nTodas las pruebas pasaron');
console.log(`Nota: ${email} quedó creado como usuario real (se borra con node scripts/cleanup-test-data.mjs).`);
process.exit(failed ? 1 : 0);
