#!/usr/bin/env node
// Prueba el alta de gente a una organizacion ya existente (Edge Function org-console) por
// el camino real: login con la llave publica, igual que haria el navegador.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... DEMO_PASSWORD=... node scripts/org-console-check.mjs
import { createClient } from '@supabase/supabase-js';
import { SPONSORS } from './seed-data.mjs';
import { TEST_ORG_B } from './create-org.mjs';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !anon || !password) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY y/o DEMO_PASSWORD');
  process.exit(2);
}
const GEB = SPONSORS[1].id;
const tag = `org-console-check-${Date.now()}`;

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
async function invoke(c, body) {
  return c.functions.invoke('org-console', { body });
}

// Sin sesion, rechazado antes de tocar nada.
{
  const anonClient = client();
  const { data, error } = await invoke(anonClient, { action: 'add_team_member', email: 'x@example.com' });
  check('org-console sin sesion se rechaza', !!error || data?.error === 'no_autorizado', error?.message || data?.error);
}

// Un contacto de patrocinador (no "team") tampoco puede usar esto, aunque sea de su propia org.
{
  const bc = await login('bc@sponsor.example');
  const { data, error } = await invoke(bc, { action: 'add_team_member', email: 'x@example.com' });
  check('org-console rechaza a un patrocinador (no es equipo)', !!error || data?.error === 'no_autorizado', error?.message || data?.error);
}

const team = await login('juanga@startco.example');

// Sumar otro miembro de equipo a StartCo.
const teamEmail = `${tag}-team@example.com`;
{
  const { data, error } = await invoke(team, { action: 'add_team_member', email: teamEmail, full_name: 'Equipo Check' });
  check('org-console suma un miembro de equipo', !error && !data?.error && Boolean(data?.password), error?.message || data?.error);
  if (data?.password) {
    const newTeam = await login(teamEmail, data.password);
    const { data: prof } = await newTeam.from('profiles').select('kind, organization_id').eq('id', (await newTeam.auth.getUser()).data.user.id).single();
    check('el nuevo miembro queda con kind=team en la organizacion correcta', prof?.kind === 'team' && Boolean(prof?.organization_id));
    const { data: sponsors } = await newTeam.from('sponsors').select('id');
    check('el nuevo miembro ve los patrocinadores de StartCo', (sponsors || []).length > 0, `${sponsors?.length}`);
  }
}

// Dar de alta el contacto de un patrocinador propio (GEB es de StartCo).
const sponsorEmail = `${tag}-sponsor@example.com`;
{
  const { data, error } = await invoke(team, { action: 'add_sponsor_contact', sponsor_id: GEB, email: sponsorEmail, full_name: 'Contacto Check', title: 'QA' });
  check('org-console suma el contacto de un patrocinador propio', !error && !data?.error && Boolean(data?.password), error?.message || data?.error);
  if (data?.password) {
    const newSponsor = await login(sponsorEmail, data.password);
    const { data: sponsors } = await newSponsor.from('sponsors').select('id');
    check('el contacto nuevo ve solo su propio patrocinio', sponsors?.length === 1 && sponsors[0].id === GEB, `${sponsors?.length}`);
  }
}

// No puede dar de alta un contacto para un patrocinador de otra organizacion. El patrocinador
// de prueba en Org B se crea con el RPC create_sponsor (no con un insert directo: ver el
// comentario en 0014_create_sponsor_rpc.sql sobre por que el insert directo no es confiable).
let orgB;
try { orgB = await login(TEST_ORG_B.teamEmail); } catch { orgB = null; }
if (!orgB) {
  console.log('SALTEADO chequeos cruzados con Org B (correr primero: node scripts/create-org.mjs)');
} else {
  const { data: evB } = await orgB.from('events').select('id').single();
  const { data: sponsorB, error: spErr } = await orgB.rpc('create_sponsor', {
    p_event_id: evB.id, p_name: tag, p_initials: 'OC', p_tier: 'Seed', p_value_cop: 1,
    p_sector: '', p_contact_name: '', p_contact_role: '', p_contact_email: '', p_contact_phone: '',
  });
  if (sponsorB?.id) {
    const { data, error } = await invoke(team, { action: 'add_sponsor_contact', sponsor_id: sponsorB.id, email: `${tag}-cross@example.com` });
    check('StartCo no puede dar de alta un contacto de un patrocinador de otra organizacion', !!error || data?.error === 'no_autorizado', error?.message || data?.error);
    await orgB.from('sponsors').delete().eq('id', sponsorB.id);
  } else {
    console.log('SALTEADO (no se pudo crear el patrocinador de prueba en Org B)', spErr?.message || '');
  }

  // Conflictos de identidad: un email que ya es de otra organizacion no se puede sumar como
  // equipo ni como contacto de patrocinador de StartCo (pisarlo lo dejaria con dos roles).
  const { data: d1, error: e1 } = await invoke(team, { action: 'add_team_member', email: TEST_ORG_B.teamEmail, full_name: 'x' });
  check('no se puede sumar como equipo a un email que ya es de otra organización', !!e1 || d1?.error === 'ese_email_ya_pertenece_a_otra_organizacion', e1?.message || d1?.error);

  const { data: d2, error: e2 } = await invoke(team, { action: 'add_sponsor_contact', sponsor_id: GEB, email: TEST_ORG_B.teamEmail, full_name: 'x' });
  check('no se puede sumar como contacto a un email que ya es de otra organización', !!e2 || d2?.error === 'ese_email_ya_pertenece_a_otra_organizacion', e2?.message || d2?.error);
}

// Tampoco se puede sumar (ni como equipo ni como contacto) a un email que ya es admin de
// plataforma -- hoy "ser admin" y "tener perfil" son excluyentes en App.jsx.
{
  const { data, error } = await invoke(team, { action: 'add_team_member', email: 'federicoruiz660@gmail.com', full_name: 'x' });
  check('no se puede sumar como equipo a un email que ya es admin de plataforma', !!error || data?.error === 'ese_email_ya_es_admin_de_plataforma', error?.message || data?.error);
}
{
  const { data, error } = await invoke(team, { action: 'add_sponsor_contact', sponsor_id: GEB, email: 'federicoruiz660@gmail.com', full_name: 'x' });
  check('no se puede sumar como contacto a un email que ya es admin de plataforma', !!error || data?.error === 'ese_email_ya_es_admin_de_plataforma', error?.message || data?.error);
}

console.log(failed ? `\n${failed} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(failed ? 1 : 0);
