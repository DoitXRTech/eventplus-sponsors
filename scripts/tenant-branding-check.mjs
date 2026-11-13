#!/usr/bin/env node
// Prueba el branding por tenant (columnas de organizations, la vista publica, quien puede
// editarlas) por el camino real: login con la llave publica, igual que haria el navegador.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... DEMO_PASSWORD=... node scripts/tenant-branding-check.mjs
import { createClient } from '@supabase/supabase-js';
import { TEST_ORG_B } from './create-org.mjs';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !anon || !password) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY y/o DEMO_PASSWORD');
  process.exit(2);
}

const STARTCO_ID = '00000000-0000-4000-8000-000000000001';
// No hace falta que exista: la policy de storage compara el segmento del path contra
// my_org_id() como texto, nunca verifica que la organizacion realmente exista.
const FOREIGN_ID = '11111111-1111-4111-8111-111111111111';

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

// La vista publica es la unica forma de pintar el logo/colores ANTES de loguearse (login,
// favicon): la prueba real es con un cliente sin sesion, no con uno ya autenticado.
{
  const anonClient = client();
  const { data, error } = await anonClient.from('organizations_public').select('*').eq('slug', 'startco').maybeSingle();
  check('anonimo lee el branding publico de StartCo', !error && data?.name === 'StartCo', error?.message);
  check('el branding trae sus colores', data?.color_primary === '#0F1419' && data?.color_accent === '#C93D0C');

  const { data: full } = await anonClient.from('organizations').select('id');
  check('anonimo no lee la tabla completa de organizations (solo la vista)', (full || []).length === 0, `${full?.length}`);
}

const team = await login('juanga@startco.example');

// El equipo edita la marca de su propia organizacion (lo deja en el mismo valor que ya
// tenia, para no pisar el demo real -- lo que se prueba es que el UPDATE pasa por RLS).
{
  const upd = await team.from('organizations').update({ color_accent: '#C93D0C' }).eq('id', STARTCO_ID).select();
  check('el equipo guarda la marca de su propia organizacion', (upd.data || []).length === 1, upd.error?.message);
}

// No la de otra organizacion real (Org B, si ya se creo con scripts/create-org.mjs).
{
  let orgB;
  try { orgB = await login(TEST_ORG_B.teamEmail); } catch { orgB = null; }
  if (!orgB) {
    console.log('SALTEADO chequeo cruzado con Org B (correr primero: node scripts/create-org.mjs)');
  } else {
    const cross = await team.from('organizations').update({ name: 'hackeado' }).eq('slug', TEST_ORG_B.slug).select();
    check('StartCo no puede tocar la marca de otra organizacion', (cross.data || []).length === 0);
  }
}

// Storage: el equipo sube a su propia carpeta de org-logos (logo y favicon), nunca a otra.
{
  const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' });
  const ownLogo = await team.storage.from('org-logos').upload(`${STARTCO_ID}/logo/check-${Date.now()}.svg`, svg, { upsert: true });
  check('el equipo sube un logo a su propia carpeta', !ownLogo.error, ownLogo.error?.message);
  const ownFavicon = await team.storage.from('org-logos').upload(`${STARTCO_ID}/favicon/check-${Date.now()}.svg`, svg, { upsert: true });
  check('el equipo sube un favicon a su propia carpeta', !ownFavicon.error, ownFavicon.error?.message);
  const foreign = await team.storage.from('org-logos').upload(`${FOREIGN_ID}/logo/check-${Date.now()}.svg`, svg, { upsert: true });
  check('el equipo no sube nada a la carpeta de otra organizacion', !!foreign.error, foreign.error?.message);
}

// Un contacto de patrocinador (no "team") no puede tocar la marca, aunque sea de su org.
{
  const bc = await login('bc@sponsor.example');
  const asSponsor = await bc.from('organizations').update({ color_accent: '#000000' }).eq('id', STARTCO_ID).select();
  check('un patrocinador no puede cambiar la marca (solo el equipo)', (asSponsor.data || []).length === 0);
}

console.log(failed ? `\n${failed} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(failed ? 1 : 0);
