#!/usr/bin/env node
// Crea una organizacion: fila en organizations, su primer evento y su primer usuario de
// equipo. Sirve tanto para dar de alta un organizador real como para crear la organizacion
// "B" que usa scripts/rls-check.mjs para probar el aislamiento entre organizaciones.
// Corre en una maquina de confianza, nunca en el navegador: usa la llave secreta.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-org.mjs
//     [--name "Nombre"] [--slug slug] [--event "Nombre del evento"] [--city Ciudad]
//     [--venue Lugar] [--team-email correo@dominio] [--team-name "Nombre"]
// Idempotente por slug: si la organizacion ya existe, reusa su id (y el de su primer
// evento) en vez de duplicar. Sin --slug, crea/reusa la organizacion de prueba que espera
// rls-check.mjs. La clave es DEMO_PASSWORD si esta seteada; si no, una generada al azar.
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Organizacion de prueba que usa rls-check.mjs para confirmar el aislamiento cruzado.
// Se exporta sola, sin tocar SUPABASE_URL/KEY, para que importar este archivo no dispare
// el alta real - eso solo pasa cuando el archivo se corre directo (ver el guard al final).
export const TEST_ORG_B = {
  slug: 'org-b-qa',
  name: 'Org B (QA cross-tenant)',
  event: 'Evento QA',
  city: 'Bogotá',
  venue: 'Oficina QA',
  teamEmail: 'team@org-b-qa.example',
  teamName: 'Equipo QA',
};

async function main() {
  const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!URL_ || !KEY) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }
  const H = { apikey: KEY, 'Content-Type': 'application/json' };
  if (KEY.split('.').length === 3) H.Authorization = `Bearer ${KEY}`;

  const call = async (method, path, body) => {
    const r = await fetch(URL_ + path, { method, headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };

  const argv = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    if (process.argv[i]?.startsWith('--')) argv[process.argv[i].slice(2)] = process.argv[i + 1];
  }
  const cfg = {
    name: argv.name || TEST_ORG_B.name,
    slug: argv.slug || TEST_ORG_B.slug,
    event: argv.event || TEST_ORG_B.event,
    city: argv.city || TEST_ORG_B.city,
    venue: argv.venue || TEST_ORG_B.venue,
    teamEmail: argv['team-email'] || TEST_ORG_B.teamEmail,
    teamName: argv['team-name'] || TEST_ORG_B.teamName,
  };
  const password = process.env.DEMO_PASSWORD || `Demo-${randomBytes(6).toString('base64url')}`;

  const existingOrg = await call('GET', `/rest/v1/organizations?slug=eq.${encodeURIComponent(cfg.slug)}&select=id,name`);
  let org = existingOrg?.[0];
  if (org) console.log(`Organización ya existía: ${org.name} (${org.id})`);
  else {
    [org] = await call('POST', '/rest/v1/organizations', [{ name: cfg.name, slug: cfg.slug }]);
    console.log(`Organización creada: ${cfg.name} (${org.id})`);
  }

  const existingEvents = await call('GET', `/rest/v1/events?organization_id=eq.${org.id}&select=id,name`);
  let event = existingEvents?.[0];
  if (event) console.log(`Evento ya existía: ${event.name} (${event.id})`);
  else {
    [event] = await call('POST', '/rest/v1/events', [{
      name: cfg.event, city: cfg.city, venue: cfg.venue, organization_id: org.id,
      start_date: '2027-01-01', end_date: '2027-01-02',
    }]);
    console.log(`Evento creado: ${cfg.event} (${event.id})`);
  }

  const users = await call('GET', '/auth/v1/admin/users?page=1&per_page=200');
  let user = users.users.find((u) => u.email === cfg.teamEmail);
  if (user) await call('PUT', `/auth/v1/admin/users/${user.id}`, { password, email_confirm: true });
  else user = await call('POST', '/auth/v1/admin/users', { email: cfg.teamEmail, password, email_confirm: true, user_metadata: { full_name: cfg.teamName } });
  await call('POST', '/rest/v1/profiles?on_conflict=id', [{ id: user.id, full_name: cfg.teamName, title: 'Equipo', kind: 'team', sponsor_id: null, organization_id: org.id }]);

  console.log(`Listo. Equipo: ${cfg.teamEmail} / ${password}`);
}

// Solo corre el alta cuando el archivo se ejecuta directo (node scripts/create-org.mjs),
// nunca cuando otro script lo importa solamente por TEST_ORG_B (ej. rls-check.mjs).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
