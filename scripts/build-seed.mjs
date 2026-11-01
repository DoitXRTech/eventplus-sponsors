#!/usr/bin/env node
// Genera supabase/seed.sql (datos de ejemplo) y supabase/setup.sql (todo en un archivo
// para pegar en el SQL Editor de Supabase). Uso: node scripts/build-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIER_VALUES, commitmentsForTier } from '../src/lib/catalog.js';
import { EVENT, SPONSORS, PROSPECTS, PROPOSAL_NOTES, generateAttendees } from './seed-data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const ago = (days, time = '09:00') => `(date_trunc('day', now()) - interval '${days} days' + time '${time}')`;
const arr = (xs) => `array[${xs.map(q).join(',')}]::text[]`;

const out = [];
out.push('-- Generado por scripts/build-seed.mjs. No editar a mano.');
out.push('-- Borra y vuelve a cargar los datos de ejemplo (no toca usuarios ni perfiles del equipo).');
out.push('begin;');
// Los patrocinadores se actualizan en su lugar (upsert) para no borrar los perfiles ligados a ellos.
const ids = SPONSORS.map((s) => q(s.id)).join(', ');
for (const t of ['assets', 'sponsored_startups', 'attendees', 'comments', 'documents', 'proposals', 'commitment_status', 'activity']) {
  out.push(`delete from public.${t} where sponsor_id in (${ids});`);
}
out.push(`delete from public.prospects where event_id = ${q(EVENT.id)};`);
out.push(`insert into public.events (id, name, city, venue, start_date, end_date) values (${q(EVENT.id)}, ${q(EVENT.name)}, ${q(EVENT.city)}, ${q(EVENT.venue)}, current_date + ${EVENT.startInDays}, current_date + ${EVENT.startInDays + EVENT.lengthDays - 1})
  on conflict (id) do update set name = excluded.name, city = excluded.city, venue = excluded.venue, start_date = excluded.start_date, end_date = excluded.end_date;`);
const SPONSOR_COLS = ['event_id', 'name', 'initials', 'tier', 'stage', 'stage_changed_at', 'value_cop', 'sector', 'contact_name', 'contact_role', 'contact_email', 'contact_phone', 'legal_razon', 'legal_rut', 'legal_domicilio', 'legal_cc_status', 'hubspot_contacts', 'hubspot_segments', 'contract_type', 'contract_status', 'contract_signed_at', 'logo_path', 'nps', 'nps_quote', 'social_views'];

for (const p of PROSPECTS) {
  out.push(`insert into public.prospects (event_id, name, stage, tier, contact, stage_since) values (${q(EVENT.id)}, ${q(p[0])}, ${q(p[1])}, ${q(p[2])}, ${q(p[3])}, now() - interval '${p[4]} days');`);
}

const author = (s, who) => {
  if (who === 'sponsor') return { name: s.contact.name, role: s.name, team: 'sponsor' };
  if (who === 'carolina') return { name: 'Carolina (Diseño)', role: 'Diseño', team: 'startco' };
  return { name: 'JuanGa', role: 'Comercial', team: 'startco' };
};

SPONSORS.forEach((s, idx) => {
  const c = s.contract;
  out.push(`\n-- ${s.name}`);
  out.push(`insert into public.sponsors (id, event_id, name, initials, tier, stage, stage_changed_at, value_cop, sector, contact_name, contact_role, contact_email, contact_phone, legal_razon, legal_rut, legal_domicilio, legal_cc_status, hubspot_contacts, hubspot_segments, contract_type, contract_status, contract_signed_at, logo_path, nps, nps_quote, social_views) values (${[
    q(s.id), q(EVENT.id), q(s.name), q(s.initials), q(s.tier), q(s.stage), `now() - interval '${s.daysInStage} days'`,
    TIER_VALUES[s.tier], q(s.sector), q(s.contact.name), q(s.contact.role), q(s.contact.email), q(s.contact.phone),
    q(s.legal.razon), q(s.legal.rut), q(s.legal.domicilio), q(s.legal.cc), s.hubspot.contacts, arr(s.hubspot.segments),
    q(c.type), q(c.status), c.signedDaysAgo ? `current_date - ${c.signedDaysAgo}` : 'null',
    // logo de ejemplo: la ruta termina en seed-logo y la app muestra las iniciales sin pedir el archivo
    s.logo ? q(`${s.id}/logo/seed-logo`) : 'null',
    s.post ? s.post.nps : 'null', q(s.post?.quote), s.post ? s.post.views : 'null',
  ].join(', ')})
  on conflict (id) do update set ${SPONSOR_COLS.map((c) => `${c} = excluded.${c}`).join(', ')};`);
  // el trigger pone stage_changed_at = now() si la etapa cambio; se fija la fecha del ejemplo
  out.push(`update public.sponsors set stage_changed_at = now() - interval '${s.daysInStage} days' where id = ${q(s.id)};`);

  for (const [name, status, daysAgo] of s.assets) {
    const sent = status === 'produccion' ? 'null' : ago(daysAgo + 1, '10:00');
    const reviewed = status === 'aprobado' ? ago(daysAgo, '15:00') : 'null';
    out.push(`insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values (${q(s.id)}, ${q(name)}, ${q(status)}, ${sent}, ${reviewed}, ${ago((daysAgo ?? 5) + 2)});`);
  }
  for (const [name, sector] of s.startups) {
    out.push(`insert into public.sponsored_startups (sponsor_id, name, sector) values (${q(s.id)}, ${q(name)}, ${q(sector)});`);
  }
  for (const a of generateAttendees(s, idx)) {
    out.push(`insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values (${q(s.id)}, ${q(a.name)}, ${q(a.email)}, ${q(a.role)}, ${q(a.day)}, ${q(a.status)}, now() - interval '${a.daysAgo} days' - interval '${(a.email.length % 20)} hours');`);
  }
  for (const [who, daysAgo, time, body, ctx, att] of s.comments) {
    const au = author(s, who);
    out.push(`insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values (${[
      q(s.id), q(au.name), q(au.role), q(au.team), q(body), q(ctx?.[0]), q(ctx?.[1]), q(att?.[0]), att ? att[1] : 'null', ago(daysAgo, time),
    ].join(', ')});`);
  }
  for (let v = 1; v <= s.proposalVersions; v++) {
    const last = v === s.proposalVersions;
    const status = last ? (s.proposalPending ? 'enviada' : 'aprobada') : 'cambios';
    const created = 70 - (s.proposalVersions - v) * 7;
    out.push(`insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values (${q(s.id)}, ${v}, ${q(PROPOSAL_NOTES[Math.min(v - 1, 2)])}, ${q(status)}, 'JuanGa', ${status === 'enviada' ? 'null' : ago(created - 2)}, ${ago(s.proposalPending ? 1 : created)});`);
  }
  if (!s.noLegalDocs) {
    for (const [name, verified] of [[`RUT_${s.initials}.pdf`, true], [`Camara_comercio_${s.initials}.pdf`, true], [`Cert_bancario_${s.initials}.pdf`, s.stage !== 'contract']]) {
      out.push(`insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values (${q(s.id)}, 'legal', ${q(name)}, ${100000 + name.length * 9137}, ${verified}, ${ago(60)});`);
    }
  }
  if (c.status === 'Firmado') {
    out.push(`insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values (${q(s.id)}, 'contrato', ${q(`Contrato_${s.initials}_firmado.pdf`)}, 412000, true, current_date - ${c.signedDaysAgo});`);
  }
  // Compromisos: post-evento todo cumplido; listo para evento, lo previo al evento.
  const pre = ['imagen-en-pagina-web-del-evento', 'marketing-digital-en-redes-sociales', 'mencion-en-boletin-de-prensa-30-medios', 'apadrinamientos-de-startups'];
  for (const cm of commitmentsForTier(s.tier)) {
    const done = s.stage === 'post' || (s.stage === 'ready' && pre.includes(cm.key));
    if (done) out.push(`insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values (${q(s.id)}, ${q(cm.key)}, true, now() - interval '1 day');`);
  }
});

// La bitacora la llenan los triggers con la hora de la carga; se reescribe con fechas coherentes.
out.push(`\ndelete from public.activity where sponsor_id in (${ids});`);
out.push(`insert into public.activity (sponsor_id, kind, text, actor_name, internal, created_at)
select c.sponsor_id, 'comment', c.author_name || ' escribió en ' || s.name, c.author_name, false, c.created_at
  from public.comments c join public.sponsors s on s.id = c.sponsor_id where s.event_id = ${q(EVENT.id)};`);
out.push(`insert into public.activity (sponsor_id, kind, text, actor_name, internal, created_at)
select a.sponsor_id, 'asset', s.name || ' aprobó ' || a.name, s.contact_name, false, a.reviewed_at
  from public.assets a join public.sponsors s on s.id = a.sponsor_id where a.status = 'aprobado' and s.event_id = ${q(EVENT.id)};`);
out.push('commit;');

const seed = out.join('\n') + '\n';
writeFileSync(join(root, 'supabase/seed.sql'), seed);

const read = (p) => readFileSync(join(root, p), 'utf8');
const setup = [
  '-- EventPlus Sponsors: instalación completa en un solo archivo.',
  '-- Pegar entero en Supabase > SQL Editor > Run. Se puede volver a correr: recarga los datos de ejemplo.',
  '-- Generado por scripts/build-seed.mjs a partir de supabase/migrations/*.sql y supabase/seed.sql.',
  '', read('supabase/migrations/0001_schema.sql'), read('supabase/migrations/0002_storage.sql'), seed,
].join('\n');
writeFileSync(join(root, 'supabase/setup.sql'), setup);
console.log(`seed.sql: ${seed.split('\n').length} líneas; setup.sql listo`);
