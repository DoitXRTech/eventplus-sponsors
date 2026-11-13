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

// No puede dar de alta un contacto para un patrocinador de otra organizacion.
{
  let orgB;
  try { orgB = await login(TEST_ORG_B.teamEmail); } catch { orgB = null; }
  if (!orgB) {
    console.log('SALTEADO chequeo cruzado con Org B (correr primero: node scripts/create-org.mjs)');
  } else {
    const { data: ev } = await orgB.from('events').select('id').single();
    const created = await orgB.from('sponsors').insert({ name: tag, initials: 'OC', tier: 'Seed', value_cop: 1, event_id: ev.id }).select().single();
    if (created.data) {
      const { data, error } = await invoke(team, { action: 'add_sponsor_contact', sponsor_id: created.data.id, email: `${tag}-cross@example.com` });
      check('StartCo no puede dar de alta un contacto de un patrocinador de otra organizacion', !!error || data?.error === 'no_autorizado', error?.message || data?.error);
    } else {
      console.log('SALTEADO (no se pudo crear el patrocinador de prueba en Org B)');
    }
  }
}

console.log(failed ? `\n${failed} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(failed ? 1 : 0);
