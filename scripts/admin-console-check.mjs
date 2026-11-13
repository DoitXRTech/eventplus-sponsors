#!/usr/bin/env node
// Prueba el admin de plataforma por el camino real: login con la llave publica (como el
// navegador) + la Edge Function admin-console. Crea una organizacion y un admin de
// plataforma nuevos en cada corrida (quedan con prefijo admin-check-<timestamp>, se puede
// borrar a mano despues si molesta -- no hay forma de borrarlos desde la app a proposito,
// ver 0008_platform_admin.sql).
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... \
//     node scripts/admin-console-check.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
if (!url || !anon || !adminEmail || !adminPassword) {
  console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY, PLATFORM_ADMIN_EMAIL y/o PLATFORM_ADMIN_PASSWORD');
  process.exit(2);
}
// Cualquier usuario de equipo real sirve para probar que uno sin el rol no puede nada de esto.
const nonAdminEmail = process.env.NON_ADMIN_EMAIL || 'juanga@startco.example';
const nonAdminPassword = process.env.DEMO_PASSWORD;

let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${name}${extra ? ` (${extra})` : ''}`);
};
const client = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
async function login(email, password) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}
async function invoke(c, body) {
  return c.functions.invoke('admin-console', { body });
}

const tag = `admin-check-${Date.now()}`;

// Sin sesion: la Edge Function tiene que rechazar antes de tocar nada.
{
  const anonClient = client();
  const { data, error } = await invoke(anonClient, { action: 'create_org', name: 'x', slug: tag, event: { name: 'x', start: '2027-01-01', end: '2027-01-02' }, team: { email: 'x@example.com' } });
  check('admin-console sin sesion se rechaza', !!error || data?.error === 'no_autorizado', error?.message || data?.error);
}

// Un usuario de equipo normal no es admin de plataforma, ni por RLS ni por la funcion.
let nonAdmin;
if (nonAdminPassword) {
  nonAdmin = await login(nonAdminEmail, nonAdminPassword);
  const { data: isAdmin } = await nonAdmin.rpc('is_platform_admin');
  check('un usuario de equipo normal no es admin de plataforma', isAdmin === false);
  const insert = await nonAdmin.from('organizations').insert({ name: 'x', slug: `${tag}-rls` }).select();
  check('un usuario de equipo no puede insertar organizaciones por RLS', !!insert.error, insert.error?.message);
  const { data: orgs } = await nonAdmin.from('organizations').select('id');
  check('un usuario de equipo solo ve su propia organizacion', (orgs || []).length === 1, `${orgs?.length}`);
  const { data: fnData, error: fnErr } = await invoke(nonAdmin, { action: 'create_org', name: 'x', slug: `${tag}-fn`, event: { name: 'x', start: '2027-01-01', end: '2027-01-02' }, team: { email: 'x@example.com' } });
  check('admin-console rechaza a un usuario de equipo normal', !!fnErr || fnData?.error === 'no_autorizado', fnErr?.message || fnData?.error);
} else {
  console.log('SALTEADO chequeo de usuario normal (seteá DEMO_PASSWORD para incluirlo)');
}

// El admin de plataforma: quien es, y que NO deberia poder ver.
const admin = await login(adminEmail, adminPassword);
const { data: isAdmin } = await admin.rpc('is_platform_admin');
check('la cuenta configurada es admin de plataforma', isAdmin === true);
const { data: profile } = await admin.from('profiles').select('id').eq('id', (await admin.auth.getUser()).data.user.id).maybeSingle();
check('el admin de plataforma no tiene perfil de ninguna organizacion', profile === null);
const { data: sponsorsSeen } = await admin.from('sponsors').select('id');
check('el admin de plataforma no ve patrocinadores de ningun tenant', (sponsorsSeen || []).length === 0, `${sponsorsSeen?.length}`);
const { data: orgsSeen } = await admin.from('organizations').select('id');
check('el admin de plataforma ve organizaciones (mas de una)', (orgsSeen || []).length > 1, `${orgsSeen?.length}`);

// Crear una organizacion nueva por la Edge Function: organizacion + evento + primer team.
const slug = `${tag}-org`;
const teamEmail = `team@${tag}.example`;
const { data: created, error: createErr } = await invoke(admin, {
  action: 'create_org', name: 'Admin Check Org', slug,
  event: { name: 'Evento Admin Check', city: 'Test', venue: 'Test', start: '2027-06-01', end: '2027-06-02' },
  team: { email: teamEmail, name: 'Team Admin Check' },
});
check('admin-console crea organizacion + evento + equipo', !createErr && !created?.error && Boolean(created?.team?.password), createErr?.message || created?.error);

if (created?.team?.password) {
  const newTeam = await login(teamEmail, created.team.password);
  const { data: newTeamAdmin } = await newTeam.rpc('is_platform_admin');
  check('el equipo nuevo no hereda el rol de admin de plataforma', newTeamAdmin === false);
  const { data: myEvents } = await newTeam.from('events').select('id, organization_id');
  check('el equipo nuevo ve su propio evento', myEvents?.length === 1 && myEvents[0].organization_id === created.organization.id, `${myEvents?.length}`);
  const { data: crossSponsors } = await newTeam.from('sponsors').select('id');
  check('el equipo nuevo no ve patrocinadores de otras organizaciones (parte vacio)', (crossSponsors || []).length === 0, `${crossSponsors?.length}`);
}

// Volver a correr con el mismo slug: no deberia duplicar la organizacion ni el evento.
const { data: repeat } = await invoke(admin, {
  action: 'create_org', name: 'Admin Check Org', slug,
  event: { name: 'Evento Admin Check (otra vez)', start: '2027-06-01', end: '2027-06-02' },
  team: { email: teamEmail, name: 'Team Admin Check' },
});
check('crear de nuevo con el mismo slug reusa la organizacion (no duplica)', repeat?.organization?.id === created?.organization?.id);

// Listar organizaciones (con el email de cada equipo, eso no sale de un select comun) y
// editar una: las dos pasan por la Admin API / service_role, por eso viven en la funcion.
if (created?.organization) {
  const { data: listed, error: listErr } = await invoke(admin, { action: 'list_orgs' });
  check('list_orgs no tira error', !listErr && !listed?.error, listErr?.message || listed?.error);
  const found = listed?.organizations?.find((o) => o.id === created.organization.id);
  check('list_orgs trae el email del equipo recien creado', found?.team?.some((t) => t.email === teamEmail), JSON.stringify(found?.team));

  const editedName = `${created.organization.name} (editado)`;
  const { data: updated, error: updErr } = await invoke(admin, {
    action: 'update_org', id: created.organization.id, name: editedName, slug, color_primary: '#111111', color_accent: '#222222',
  });
  check('update_org guarda los cambios', !updErr && updated?.organization?.name === editedName, updErr?.message || updated?.error);
  const { data: relisted } = await invoke(admin, { action: 'list_orgs' });
  const after = relisted?.organizations?.find((o) => o.id === created.organization.id);
  check('el cambio de update_org persiste en una relectura', after?.name === editedName && after?.color_accent === '#222222');

  // Logo y favicon: el admin no es "team" de esta organizacion, asi que si funcionan es
  // porque pasan por service_role adentro de la funcion, no por una policy de storage.
  const dataBase64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
  const { data: withLogo, error: logoErr } = await invoke(admin, { action: 'upload_org_logo', id: created.organization.id, filename: 'logo.svg', contentType: 'image/svg+xml', dataBase64 });
  check('admin-console sube un logo para una organizacion que no es la suya', !logoErr && Boolean(withLogo?.organization?.logo_path), logoErr?.message || withLogo?.error);
  const { data: withFavicon, error: favErr } = await invoke(admin, { action: 'upload_org_favicon', id: created.organization.id, filename: 'favicon.svg', contentType: 'image/svg+xml', dataBase64 });
  check('admin-console sube un favicon para una organizacion que no es la suya', !favErr && Boolean(withFavicon?.organization?.favicon_path), favErr?.message || withFavicon?.error);

  if (nonAdminPassword) {
    const { data: d3, error: e3 } = await invoke(nonAdmin, { action: 'upload_org_logo', id: created.organization.id, filename: 'x.svg', contentType: 'image/svg+xml', dataBase64 });
    check('upload_org_logo rechaza a un usuario de equipo normal', !!e3 || d3?.error === 'no_autorizado', e3?.message || d3?.error);
    const { data: d4, error: e4 } = await invoke(nonAdmin, { action: 'upload_org_favicon', id: created.organization.id, filename: 'x.svg', contentType: 'image/svg+xml', dataBase64 });
    check('upload_org_favicon rechaza a un usuario de equipo normal', !!e4 || d4?.error === 'no_autorizado', e4?.message || d4?.error);
  }
}
if (nonAdmin) {
  const { data: d1, error: e1 } = await invoke(nonAdmin, { action: 'list_orgs' });
  check('list_orgs rechaza a un usuario de equipo normal', !!e1 || d1?.error === 'no_autorizado', e1?.message || d1?.error);
  const { data: d2, error: e2 } = await invoke(nonAdmin, { action: 'update_org', id: 'x', name: 'x', slug: 'x' });
  check('update_org rechaza a un usuario de equipo normal', !!e2 || d2?.error === 'no_autorizado', e2?.message || d2?.error);
}

// Sumar otro admin de plataforma desde la app, sin tocar la base a mano.
const newAdminEmail = `${tag}@qa-test.example`;
const { data: addResult, error: addErr } = await invoke(admin, { action: 'add_platform_admin', email: newAdminEmail, full_name: 'Admin Check' });
check('admin-console suma un admin de plataforma nuevo', !addErr && !addResult?.error && Boolean(addResult?.password), addErr?.message || addResult?.error);
if (addResult?.password) {
  const newAdmin = await login(newAdminEmail, addResult.password);
  const { data: reallyAdmin } = await newAdmin.rpc('is_platform_admin');
  check('el admin recien sumado ya tiene el rol', reallyAdmin === true);
}

console.log(`\nQuedaron creados (no se borran solos): organizacion "${slug}", equipo "${teamEmail}", admin "${newAdminEmail}".`);
console.log(failed ? `\n${failed} pruebas fallaron` : '\nTodas las pruebas pasaron');
process.exit(failed ? 1 : 0);
