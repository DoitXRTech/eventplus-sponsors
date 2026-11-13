#!/usr/bin/env node
// Prueba el RPC create_sponsor (migracion 0014) por el camino real: login con la llave
// publica + supabase.rpc, igual que hace NewSponsor.jsx. Nace de un bug real: el INSERT
// directo contra sponsors fallaba siempre contra RLS (ver el comentario en esa migracion),
// asi que el alta se movio a esta funcion security definer con su propio chequeo de permisos
// adentro -- lo que hay que probar es justo eso: que el chequeo manual reemplaza bien a la
// policy que no se podia hacer andar.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... DEMO_PASSWORD=... node scripts/create-sponsor-check.mjs
import { createClient } from '@supabase/supabase-js';
import { TEST_ORG_B } from './create-org.mjs';

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
const rpcArgs = (evId, name) => ({
  p_event_id: evId, p_name: name, p_initials: 'CS', p_tier: 'Seed', p_value_cop: 1,
  p_sector: 'QA', p_contact_name: '', p_contact_role: '', p_contact_email: '', p_contact_phone: '',
});

const team = await login('juanga@startco.example');
const { data: ev } = await team.from('events').select('id').limit(1).single();
const tag = `create-sponsor-check-${Date.now()}`;

// Sin sesion, rechazado antes de tocar nada.
{
  const pub = client();
  const { error } = await pub.rpc('create_sponsor', rpcArgs(ev.id, tag));
  check('create_sponsor sin sesion se rechaza', !!error, error?.message);
}

// Un contacto de patrocinador (no "team") tampoco puede, aunque sea de su propia org.
{
  const bc = await login('bc@sponsor.example');
  const { error } = await bc.rpc('create_sponsor', rpcArgs(ev.id, tag));
  check('create_sponsor rechaza a un patrocinador (no es equipo)', !!error, error?.message);
}

// El equipo no puede crear un patrocinador contra el evento de OTRA organizacion.
{
  let orgB;
  try { orgB = await login(TEST_ORG_B.teamEmail); } catch { orgB = null; }
  if (!orgB) {
    console.log('SALTEADO chequeo cruzado con Org B (correr primero: node scripts/create-org.mjs)');
  } else {
    const { data: evB } = await orgB.from('events').select('id').limit(1).single();
    const { error } = await team.rpc('create_sponsor', rpcArgs(evB.id, tag));
    check('StartCo no puede crear un patrocinador en el evento de otra organización', !!error, error?.message);
  }
}

// Camino feliz: el equipo crea un patrocinador para su propio evento.
let created;
{
  const { data, error } = await team.rpc('create_sponsor', rpcArgs(ev.id, tag));
  check('create_sponsor crea el patrocinador', !error && Boolean(data?.id), error?.message);
  created = data;
}

if (created?.id) {
  const { data: back } = await team.from('sponsors').select('id, name, organization_id, tier, value_cop').eq('id', created.id).maybeSingle();
  check('el patrocinador creado tiene los datos correctos', back?.name === tag && back?.tier === 'Seed' && Number(back?.value_cop) === 1);
  check('organization_id lo completa el trigger (no el RPC)', Boolean(back?.organization_id));

  let orgB;
  try { orgB = await login(TEST_ORG_B.teamEmail); } catch { orgB = null; }
  if (orgB) {
    const { data: crossView } = await orgB.from('sponsors').select('id').eq('id', created.id).maybeSingle();
    check('otra organización no ve el patrocinador recién creado', crossView === null);
  }

  await team.from('sponsors').delete().eq('id', created.id);
}

console.log(failed ? `\n${failed} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(failed ? 1 : 0);
