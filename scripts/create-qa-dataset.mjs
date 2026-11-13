#!/usr/bin/env node
// Crea un set de datos "reales" para que QA pruebe el aislamiento multitenant: 2
// organizaciones nuevas (QA Norte, QA Sur), cada una con su evento, 2 usuarios de equipo
// y 3 patrocinadores con historiales distintos (piezas pendientes, propuestas, inscritos,
// startups apadrinadas, comentarios, documentos) y su contacto de patrocinador.
//
// No toca StartCo ni "Org B (QA cross-tenant)" (esa la usa scripts/rls-check.mjs).
//
// Corre en una maquina de confianza, nunca en el navegador: usa la llave secreta.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_PASSWORD=... node scripts/create-qa-dataset.mjs
//
// Idempotente para organizacion/evento/usuario (reusa por slug/email, resetea la clave).
// Los datos colgantes de cada sponsor (assets, comments, etc.) solo se cargan la primera
// vez por sponsor -- pensado para correr una vez por ambiente.
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
if (!URL_ || !KEY) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const H = { apikey: KEY, 'Content-Type': 'application/json' };
if (KEY.split('.').length === 3) H.Authorization = `Bearer ${KEY}`;
const PASSWORD = process.env.DEMO_PASSWORD || `Qa-${randomBytes(6).toString('base64url')}`;

async function call(method, path, body) {
  const r = await fetch(URL_ + path, {
    method,
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function ensureOrg(name, slug) {
  const found = await call('GET', `/rest/v1/organizations?slug=eq.${slug}&select=id`);
  if (found?.[0]) return found[0].id;
  const [row] = await call('POST', '/rest/v1/organizations', [{ name, slug }]);
  return row.id;
}

async function ensureEvent(orgId, ev) {
  const found = await call('GET', `/rest/v1/events?organization_id=eq.${orgId}&select=id`);
  if (found?.[0]) return found[0].id;
  const [row] = await call('POST', '/rest/v1/events', [{
    organization_id: orgId, name: ev.name, city: ev.city, venue: ev.venue, start_date: ev.start, end_date: ev.end,
  }]);
  return row.id;
}

let usersCache = null;
async function ensureUser(email, full_name) {
  if (!usersCache) {
    usersCache = new Map();
    for (let page = 1; ; page++) {
      const res = await call('GET', `/auth/v1/admin/users?page=${page}&per_page=200`);
      for (const u of res.users) usersCache.set(u.email, u);
      if (res.users.length < 200) break;
    }
  }
  let user = usersCache.get(email);
  if (user) await call('PUT', `/auth/v1/admin/users/${user.id}`, { password: PASSWORD, email_confirm: true });
  else {
    user = await call('POST', '/auth/v1/admin/users', { email, password: PASSWORD, email_confirm: true, user_metadata: { full_name } });
    usersCache.set(email, user);
  }
  return user;
}

async function ensureSponsor(eventId, sp) {
  const found = await call('GET', `/rest/v1/sponsors?event_id=eq.${eventId}&name=eq.${encodeURIComponent(sp.name)}&select=id`);
  if (found?.[0]) return found[0].id;
  const [row] = await call('POST', '/rest/v1/sponsors', [{
    event_id: eventId, name: sp.name, initials: sp.initials, tier: sp.tier, stage: sp.stage,
    value_cop: sp.value_cop, sector: sp.sector,
    contact_name: sp.contact.name, contact_role: sp.contact.role, contact_email: sp.contact.email, contact_phone: sp.contact.phone,
    legal_razon: sp.legal.razon, legal_rut: sp.legal.rut, legal_domicilio: sp.legal.domicilio, legal_cc_status: sp.legal.cc,
    contract_type: sp.contract_type, contract_status: sp.contract_status,
  }]);
  return row.id;
}

async function seedChildren(sponsorId, sp) {
  const already = await call('GET', `/rest/v1/assets?sponsor_id=eq.${sponsorId}&select=id&limit=1`);
  if (already?.[0]) { console.log('   (ya tenía datos cargados, no duplico)'); return; }

  for (const a of sp.assets || []) {
    await call('POST', '/rest/v1/assets', [{ sponsor_id: sponsorId, name: a.name, status: a.status, sent_at: a.status === 'produccion' ? null : new Date().toISOString() }]);
  }
  const proposals = sp.proposals || [];
  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    await call('POST', '/rest/v1/proposals', [{ sponsor_id: sponsorId, version: i + 1, note: p.note, status: p.status, author_name: p.author, reviewed_at: p.status === 'enviada' ? null : new Date().toISOString() }]);
  }
  for (const s of sp.startups || []) {
    await call('POST', '/rest/v1/sponsored_startups', [{ sponsor_id: sponsorId, name: s.name, sector: s.sector }]);
  }
  for (const a of sp.attendees || []) {
    await call('POST', '/rest/v1/attendees', [{ sponsor_id: sponsorId, name: a.name, email: a.email, role: a.role, day: a.day, status: a.status }]);
  }
  for (const c of sp.comments || []) {
    await call('POST', '/rest/v1/comments', [{ sponsor_id: sponsorId, author_name: c.author, author_role: c.role, team: c.team, body: c.body, internal: !!c.internal }]);
  }
  for (const d of sp.documents || []) {
    await call('POST', '/rest/v1/documents', [{ sponsor_id: sponsorId, kind: d.kind, name: d.name, size_bytes: d.size, verified: !!d.verified }]);
  }
  for (const key of sp.done || []) {
    await call('POST', '/rest/v1/commitment_status', [{ sponsor_id: sponsorId, commitment_key: key, done: true, done_at: new Date().toISOString() }]);
  }
  if (sp.nps) await call('PATCH', `/rest/v1/sponsors?id=eq.${sponsorId}`, { nps: sp.nps, nps_quote: sp.nps_quote || null, social_views: sp.social_views || null });
}

const ORGS = [
  {
    name: 'QA Norte', slug: 'qa-norte',
    event: { name: 'Evento QA Norte', city: 'Medellín', venue: 'Centro QA Norte', start: '2027-03-10', end: '2027-03-11' },
    team: [
      { email: 'ana.norte@qa-test.example', full_name: 'Ana Restrepo', title: 'Comercial' },
      { email: 'diego.norte@qa-test.example', full_name: 'Diego Molina', title: 'Producción' },
    ],
    sponsors: [
      {
        name: 'Acme Corp', initials: 'AC', tier: 'Partner', stage: 'approvals', value_cop: 250000000, sector: 'Fintech',
        contract_type: 'Cliente', contract_status: 'Enviado',
        contact: { name: 'Felipe Rendón', role: 'Director de Marca', email: 'contacto.acme.norte@qa-test.example', phone: '+57 300 111 2201' },
        legal: { razon: 'Acme Corp S.A.S.', rut: '900111222-1', domicilio: 'Medellín', cc: 'Vigente' },
        assets: [
          { name: 'Pendón principal', status: 'aprobado' }, { name: 'Pauta redes - lanzamiento', status: 'aprobado' },
          { name: 'Valla de agradecimiento', status: 'pendiente' }, { name: 'Video institucional 30s', status: 'produccion' },
        ],
        proposals: [{ note: 'Propuesta inicial', status: 'aprobada', author: 'Ana Restrepo' }, { note: 'Ajuste de alcance para segundo piso', status: 'enviada', author: 'Ana Restrepo' }],
        startups: [{ name: 'Rutaverde', sector: 'Movilidad' }, { name: 'Pagolisto', sector: 'Fintech' }],
        attendees: [
          { name: 'Laura Gómez', email: 'laura.gomez@acmenorte.example', role: 'Marketing', day: 'both', status: 'confirmado' },
          { name: 'Julián Rojas', email: 'julian.rojas@acmenorte.example', role: 'Ventas', day: 'd1', status: 'confirmado' },
          { name: 'Pía Correa', email: 'pia.correa@acmenorte.example', role: 'Legal', day: 'both', status: 'invitado' },
        ],
        comments: [
          { author: 'Ana Restrepo', role: 'Comercial', team: 'startco', body: 'Les dejamos la valla para revisión, avisen si quieren ajustar el logo.' },
          { author: 'Felipe Rendón', role: 'Director de Marca', team: 'sponsor', body: 'Gracias, la estamos revisando con el equipo de marca.' },
          { author: 'Diego Molina', role: 'Producción', team: 'startco', internal: true, body: 'Ojo: el cliente pidió cambiar el logo la semana pasada, confirmar que esta versión ya lo tiene.' },
        ],
        documents: [{ kind: 'legal', name: 'RUT_AC.pdf', size: 184000, verified: true }, { kind: 'contrato', name: 'Contrato_AC_enviado.pdf', size: 402000, verified: false }],
        done: ['imagen-en-pagina-web-del-evento', 'marketing-digital-en-redes-sociales'],
      },
      {
        name: 'Northwind Startups', initials: 'NW', tier: 'Serie A', stage: 'production', value_cop: 62000000, sector: 'Agro',
        contract_type: 'StartCo', contract_status: 'Firmado',
        contact: { name: 'Valentina Soto', role: 'Gerente de Marketing', email: 'contacto.northwind@qa-test.example', phone: '+57 300 111 2202' },
        legal: { razon: 'Northwind Startups SAS', rut: '900111222-2', domicilio: 'Rionegro', cc: 'Vigente' },
        assets: [{ name: 'Pendón principal', status: 'produccion' }, { name: 'Pauta redes', status: 'produccion' }],
        proposals: [{ note: 'Propuesta inicial', status: 'aprobada', author: 'Diego Molina' }],
        startups: [], attendees: [],
        comments: [{ author: 'Diego Molina', role: 'Producción', team: 'startco', internal: true, body: 'Piezas en producción, deberían estar listas para revisión del cliente la próxima semana.' }],
        documents: [], done: [],
      },
      {
        name: 'Founders Lab Norte', initials: 'FL', tier: 'Founders', stage: 'post', value_cop: 18000000, sector: 'Educación',
        contract_type: 'StartCo', contract_status: 'Firmado',
        contact: { name: 'Camilo Duarte', role: 'Fundador', email: 'contacto.founderslab@qa-test.example', phone: '+57 300 111 2203' },
        legal: { razon: 'Founders Lab Norte SAS', rut: '900111222-3', domicilio: 'Medellín', cc: 'Vigente' },
        assets: [{ name: 'Pendón principal', status: 'aprobado' }],
        proposals: [{ note: 'Propuesta única', status: 'aprobada', author: 'Ana Restrepo' }],
        startups: [],
        attendees: [
          { name: 'Marcela Ríos', email: 'marcela.rios@founderslab.example', role: 'Operaciones', day: 'both', status: 'confirmado' },
          { name: 'Esteban Páez', email: 'esteban.paez@founderslab.example', role: 'Fundador', day: 'both', status: 'confirmado' },
        ],
        comments: [{ author: 'Camilo Duarte', role: 'Fundador', team: 'sponsor', body: 'Gracias por todo, el evento salió excelente para nosotros.' }],
        documents: [{ kind: 'legal', name: 'RUT_FL.pdf', size: 150000, verified: true }, { kind: 'contrato', name: 'Contrato_FL_firmado.pdf', size: 398000, verified: true }],
        done: ['imagen-en-pagina-web-del-evento', 'marketing-digital-en-redes-sociales'],
        nps: 9.2, nps_quote: 'La mejor experiencia de apadrinamiento que tuvimos este año.', social_views: 15400,
      },
    ],
  },
  {
    name: 'QA Sur', slug: 'qa-sur',
    event: { name: 'Evento QA Sur', city: 'Cali', venue: 'Centro QA Sur', start: '2027-04-14', end: '2027-04-15' },
    team: [
      { email: 'bruno.sur@qa-test.example', full_name: 'Bruno Salazar', title: 'Comercial' },
      { email: 'carla.sur@qa-test.example', full_name: 'Carla Niño', title: 'Producción' },
    ],
    sponsors: [
      {
        name: 'Acme Corp', initials: 'AC', tier: 'Unicorn', stage: 'approvals', value_cop: 166000000, sector: 'Retail',
        contract_type: 'Mixto', contract_status: 'Enviado',
        contact: { name: 'Daniela Ríos', role: 'Directora de Marca', email: 'contacto.acme.sur@qa-test.example', phone: '+57 300 222 3301' },
        legal: { razon: 'Acme Corp Sur S.A.S.', rut: '900222333-1', domicilio: 'Cali', cc: 'Vigente' },
        assets: [{ name: 'Pendón principal', status: 'aprobado' }, { name: 'Valla de agradecimiento', status: 'pendiente' }],
        proposals: [{ note: 'Propuesta inicial', status: 'aprobada', author: 'Bruno Salazar' }, { note: 'Ajuste de branding', status: 'enviada', author: 'Bruno Salazar' }],
        startups: [{ name: 'Verdeluz', sector: 'Agro' }],
        attendees: [
          { name: 'Mauricio Lenis', email: 'mauricio.lenis@acmesur.example', role: 'Marketing', day: 'both', status: 'confirmado' },
          { name: 'Tatiana Mejía', email: 'tatiana.mejia@acmesur.example', role: 'Ventas', day: 'd2', status: 'invitado' },
        ],
        comments: [
          { author: 'Bruno Salazar', role: 'Comercial', team: 'startco', body: 'Hola Daniela, quedó pendiente la valla para su revisión.' },
          { author: 'Daniela Ríos', role: 'Directora de Marca', team: 'sponsor', body: 'Perfecto, la revisamos hoy.' },
        ],
        documents: [{ kind: 'legal', name: 'RUT_AC_sur.pdf', size: 179000, verified: true }],
        done: ['imagen-en-pagina-web-del-evento'],
      },
      {
        name: 'Southline Ventures', initials: 'SV', tier: 'Serie B', stage: 'sponsoring', value_cop: 90000000, sector: 'Salud',
        contract_type: 'StartCo', contract_status: 'Firmado',
        contact: { name: 'Tomás Vargas', role: 'Gerente Comercial', email: 'contacto.southline@qa-test.example', phone: '+57 300 222 3302' },
        legal: { razon: 'Southline Ventures SAS', rut: '900222333-2', domicilio: 'Cali', cc: 'Vigente' },
        assets: [{ name: 'Pendón principal', status: 'aprobado' }, { name: 'Pauta redes', status: 'aprobado' }],
        proposals: [{ note: 'Propuesta única', status: 'aprobada', author: 'Carla Niño' }],
        startups: [{ name: 'Saludya', sector: 'Salud' }, { name: 'Medicheck', sector: 'Salud' }],
        attendees: [{ name: 'Nicolás Prado', email: 'nicolas.prado@southline.example', role: 'Operaciones', day: 'both', status: 'confirmado' }],
        comments: [{ author: 'Carla Niño', role: 'Producción', team: 'startco', body: 'Vamos confirmando las startups apadrinadas, nos faltaría una más.' }],
        documents: [{ kind: 'legal', name: 'RUT_SV.pdf', size: 160000, verified: true }],
        done: ['imagen-en-pagina-web-del-evento', 'apadrinamientos-de-startups'],
      },
      {
        name: 'Last Call Capital', initials: 'LC', tier: 'Preseed', stage: 'contract', value_cop: 30000000, sector: 'Fintech',
        contract_type: 'Pendiente', contract_status: 'Enviado',
        contact: { name: 'Isabella Cruz', role: 'Asociada', email: 'contacto.lastcall@qa-test.example', phone: '+57 300 222 3303' },
        legal: { razon: 'Last Call Capital SAS', rut: '900222333-3', domicilio: 'Cali', cc: 'Por validar' },
        assets: [], proposals: [], startups: [], attendees: [],
        comments: [{ author: 'Bruno Salazar', role: 'Comercial', team: 'startco', body: 'Quedamos pendientes de recibir el RUT y la cámara de comercio para avanzar con el contrato.' }],
        documents: [], done: [],
      },
    ],
  },
];

async function main() {
  const lines = [`Clave de todos los usuarios QA: ${PASSWORD}`, ''];
  for (const org of ORGS) {
    console.log(`\n== ${org.name} ==`);
    const orgId = await ensureOrg(org.name, org.slug);
    const eventId = await ensureEvent(orgId, org.event);
    for (const t of org.team) {
      const u = await ensureUser(t.email, t.full_name);
      await call('POST', '/rest/v1/profiles?on_conflict=id', [{ id: u.id, full_name: t.full_name, title: t.title, kind: 'team', sponsor_id: null, organization_id: orgId }]);
      lines.push(`Equipo     ${t.email.padEnd(34)} ${org.name} · ${t.full_name}`);
    }
    for (const sp of org.sponsors) {
      const sponsorId = await ensureSponsor(eventId, sp);
      console.log(` - ${sp.name} (${sp.tier}, ${sp.stage})`);
      await seedChildren(sponsorId, sp);
      const u = await ensureUser(sp.contact.email, sp.contact.name);
      await call('POST', '/rest/v1/profiles?on_conflict=id', [{ id: u.id, full_name: sp.contact.name, title: sp.contact.role, kind: 'sponsor', sponsor_id: sponsorId }]);
      lines.push(`Patrocinio ${sp.contact.email.padEnd(34)} ${org.name} · ${sp.name} (${sp.tier}, ${sp.stage})`);
    }
  }
  writeFileSync('.qa-credentials', lines.join('\n') + '\n', { mode: 0o600 });
  console.log('\nListo. Credenciales en .qa-credentials');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
