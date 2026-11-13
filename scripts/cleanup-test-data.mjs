#!/usr/bin/env node
// Borra lo que van dejando las corridas de scripts/*-check.mjs: cada uno tagea lo que crea
// como "<nombre-del-script>-<timestamp>" (en el slug de la organizacion o en el email), y
// hoy nada de eso se borra solo -- ni desde la app (platform_admins no tiene policies de
// delete a proposito, ver 0008_platform_admin.sql). Este script busca ese patron especifico
// y lo borra; todo lo demas (StartCo, Org B QA, QA Norte, QA Sur, datos cargados a mano) no
// lo toca porque no matchea el patron.
//
// Nunca borra un usuario que sea admin de plataforma real: si un admin estaba "viendo como
// equipo" (impersonation) una organizacion de prueba, se borra el perfil temporal pero el
// usuario y su fila en platform_admins quedan intactos.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-test-data.mjs [--dry-run]
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const dryRun = process.argv.includes('--dry-run');
const admin = createClient(url, serviceKey);

const TEST_TAG = /(admin-check|smoke-test|org-console-check|tenant-branding-check|create-sponsor-check|new-sponsor-check|password-change-check|verify-rpc)-\d{10,}/;

const { data: orgs, error: orgsErr } = await admin.from('organizations').select('id, slug, name');
if (orgsErr) throw orgsErr;
const junkOrgs = (orgs || []).filter((o) => TEST_TAG.test(o.slug));

const { data: adminRows, error: adminErr } = await admin.from('platform_admins').select('user_id');
if (adminErr) throw adminErr;
const realAdminIds = new Set((adminRows || []).map((r) => r.user_id));

const { data: userPage, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (usersErr) throw usersErr;
const junkUsers = userPage.users.filter((u) => TEST_TAG.test(u.email || ''));

console.log(`Organizaciones de prueba: ${junkOrgs.length}`);
junkOrgs.forEach((o) => console.log(`  - ${o.name} (${o.slug})`));
console.log(`Usuarios de prueba (sueltos o dentro de esas organizaciones): ${junkUsers.length}`);
junkUsers.forEach((u) => console.log(`  - ${u.email}`));

if (junkOrgs.length === 0 && junkUsers.length === 0) {
  console.log('\nNo hay nada de prueba para borrar.');
  process.exit(0);
}
if (dryRun) {
  console.log('\n--dry-run: no se borró nada.');
  process.exit(0);
}

for (const o of junkOrgs) {
  const { data: profs } = await admin.from('profiles').select('id').eq('organization_id', o.id);
  for (const p of (profs || [])) {
    if (realAdminIds.has(p.id)) {
      await admin.from('profiles').delete().eq('id', p.id);
      console.log(`  (se dejó el usuario ${p.id}: es admin de plataforma real, solo se borró su perfil temporal en ${o.slug})`);
      continue;
    }
    await admin.auth.admin.deleteUser(p.id).catch((e) => console.warn(`  no se pudo borrar el usuario ${p.id}: ${e.message}`));
  }
  const { data: files } = await admin.storage.from('org-logos').list(o.id, { limit: 1000 });
  for (const sub of (files || [])) {
    const { data: subFiles } = await admin.storage.from('org-logos').list(`${o.id}/${sub.name}`, { limit: 1000 });
    const paths = (subFiles || []).map((f) => `${o.id}/${sub.name}/${f.name}`);
    if (paths.length) await admin.storage.from('org-logos').remove(paths);
  }
  await admin.from('events').delete().eq('organization_id', o.id);
  const { error: delOrgErr } = await admin.from('organizations').delete().eq('id', o.id);
  if (delOrgErr) console.warn(`  no se pudo borrar la organización ${o.slug}: ${delOrgErr.message}`);
}

for (const u of junkUsers) {
  await admin.from('platform_admins').delete().eq('user_id', u.id);
  await admin.from('profiles').delete().eq('id', u.id);
  await admin.auth.admin.deleteUser(u.id).catch((e) => console.warn(`  no se pudo borrar el usuario ${u.email}: ${e.message}`));
}

console.log('\nListo.');
