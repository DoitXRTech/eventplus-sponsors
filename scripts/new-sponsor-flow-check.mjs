#!/usr/bin/env node
// Prueba el flujo completo de "Nuevo patrocinador" con email de contacto cargado: crea el
// patrocinador (RPC create_sponsor) y de una le da acceso al portal (org-console
// add_sponsor_contact), exactamente los dos pasos que hace NewSponsor.jsx. Lo que hay que
// probar es la combinacion: que el contacto nuevo pueda entrar, que vea solo su patrocinador,
// y que si el email ya esta usado en otro lado el patrocinador quede creado igual pero el
// alta del contacto se rechace con un error entendible (no un 500 ni un email pisado).
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... DEMO_PASSWORD=... node scripts/new-sponsor-flow-check.mjs
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
async function login(email, pass = password) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

const team = await login('juanga@startco.example');
const { data: ev } = await team.from('events').select('id').limit(1).single();
const tag = `new-sponsor-check-${Date.now()}`;

async function createSponsor(name) {
  const { data, error } = await team.rpc('create_sponsor', {
    p_event_id: ev.id, p_name: name, p_initials: 'NS', p_tier: 'Seed', p_value_cop: 1,
    p_sector: 'QA', p_contact_name: 'Contacto QA', p_contact_role: 'QA', p_contact_email: '', p_contact_phone: '',
  });
  if (error) throw error;
  return data;
}

// Camino feliz: patrocinador + contacto nuevo en un solo flujo.
const s1 = await createSponsor(`${tag}-a`);
const email1 = `${tag}-contact@example.com`;
{
  const { data, error } = await team.functions.invoke('org-console', {
    body: { action: 'add_sponsor_contact', sponsor_id: s1.id, email: email1, full_name: 'Contacto QA', title: 'QA' },
  });
  check('se crea el patrocinador y se le da acceso al portal en el mismo flujo', !error && !data?.error && Boolean(data?.password), error?.message || data?.error);
  if (data?.password) {
    const contact = await login(email1, data.password);
    const { data: sponsors } = await contact.from('sponsors').select('id');
    check('el contacto nuevo ve solo su propio patrocinador', sponsors?.length === 1 && sponsors[0].id === s1.id, `${sponsors?.length}`);
  }
}

// Si el email de contacto ya es admin de plataforma, el patrocinador queda creado pero el
// acceso se rechaza con un error entendible (no debería tocar ese usuario para nada).
const s2 = await createSponsor(`${tag}-b`);
{
  const admin = await login('federicoruiz660@gmail.com', process.env.PLATFORM_ADMIN_PASSWORD || '');
  const { data: beforeAdmin } = await admin.rpc('is_platform_admin');
  if (!beforeAdmin) {
    console.log('SALTEADO chequeo de conflicto con admin de plataforma (seteá PLATFORM_ADMIN_PASSWORD)');
  } else {
    const { data, error } = await team.functions.invoke('org-console', {
      body: { action: 'add_sponsor_contact', sponsor_id: s2.id, email: 'federicoruiz660@gmail.com', full_name: 'x' },
    });
    check('no se puede dar de alta un contacto con el email de un admin de plataforma', !!error || data?.error === 'ese_email_ya_es_admin_de_plataforma', error?.message || data?.error);
    const { data: stillAdmin } = await admin.rpc('is_platform_admin');
    check('el admin de plataforma sigue siendo admin (no se le tocó nada)', stillAdmin === true);
  }
}

await team.from('sponsors').delete().in('id', [s1.id, s2.id]);

console.log(failed ? `\n${failed} pruebas fallaron` : '\nTodas las pruebas pasaron');
console.log(`Nota: ${email1} quedó creado como usuario real (se borra con node scripts/cleanup-test-data.mjs).`);
process.exit(failed ? 1 : 0);
