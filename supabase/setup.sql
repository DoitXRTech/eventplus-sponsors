-- EventPlus Sponsors: instalación completa en un solo archivo.
-- Pegar entero en Supabase > SQL Editor > Run. Se puede volver a correr: recarga los datos de ejemplo.
-- Generado por scripts/build-seed.mjs a partir de supabase/migrations/*.sql y supabase/seed.sql.

-- EventPlus Sponsors (StartCo Patrocinios): esquema, reglas de acceso y funciones.
-- Se corre una vez en el SQL Editor de Supabase (o con psql contra la DB del proyecto).
-- Es idempotente en lo posible: se puede volver a correr sin romper datos.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text not null default '',
  venue       text not null default '',
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  constraint events_dates check (end_date >= start_date)
);

create table if not exists public.sponsors (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events(id) on delete cascade,
  name               text not null,
  initials           text not null,
  tier               text not null check (tier in ('Partner','Unicorn','Serie B','Serie A','Seed','Preseed','Founders')),
  stage              text not null default 'kickoff'
                     check (stage in ('kickoff','contract','production','approvals','sponsoring','ready','post')),
  stage_changed_at   timestamptz not null default now(),
  value_cop          bigint not null check (value_cop >= 0),
  sector             text not null default '',
  contact_name       text not null default '',
  contact_role       text not null default '',
  contact_email      text not null default '',
  contact_phone      text not null default '',
  legal_razon        text not null default '',
  legal_rut          text not null default '',
  legal_domicilio    text not null default '',
  legal_cc_status    text not null default '',
  hubspot_contacts   int  not null default 0,
  hubspot_segments   text[] not null default '{}',
  contract_type      text not null default 'Pendiente' check (contract_type in ('Pendiente','StartCo','Cliente','Mixto')),
  contract_status    text not null default 'No iniciado'
                     check (contract_status in ('No iniciado','Enviado','En revisión legal','Firmado')),
  contract_signed_at date,
  logo_path          text,
  nps                numeric(3,1) check (nps between 0 and 10),
  nps_quote          text,
  social_views       int,
  created_at         timestamptz not null default now()
);
create index if not exists sponsors_event_idx on public.sponsors(event_id);

-- Perfil de cada usuario de Auth: equipo StartCo o contacto de un patrocinador.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  title       text not null default '',
  kind        text not null check (kind in ('team','sponsor')),
  sponsor_id  uuid references public.sponsors(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint profiles_kind_sponsor check ((kind = 'sponsor') = (sponsor_id is not null))
);

create table if not exists public.assets (
  id           uuid primary key default gen_random_uuid(),
  sponsor_id   uuid not null references public.sponsors(id) on delete cascade,
  name         text not null,
  status       text not null default 'produccion' check (status in ('produccion','pendiente','aprobado','cambios')),
  file_path    text,
  file_name    text,
  sent_at      timestamptz,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists assets_sponsor_idx on public.assets(sponsor_id);

create table if not exists public.sponsored_startups (
  id          uuid primary key default gen_random_uuid(),
  sponsor_id  uuid not null references public.sponsors(id) on delete cascade,
  name        text not null,
  sector      text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists startups_sponsor_idx on public.sponsored_startups(sponsor_id);

create table if not exists public.attendees (
  id          uuid primary key default gen_random_uuid(),
  sponsor_id  uuid not null references public.sponsors(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role        text not null default '',
  day         text not null default 'both' check (day in ('d1','d2','both')),
  status      text not null default 'invitado' check (status in ('confirmado','invitado','sin_abrir')),
  created_at  timestamptz not null default now(),
  unique (sponsor_id, email)
);
create index if not exists attendees_sponsor_idx on public.attendees(sponsor_id);

create table if not exists public.comments (
  id               uuid primary key default gen_random_uuid(),
  sponsor_id       uuid not null references public.sponsors(id) on delete cascade,
  author_id        uuid references public.profiles(id) on delete set null,
  author_name      text not null,
  author_role      text not null default '',
  team             text not null check (team in ('startco','sponsor','system')),
  body             text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  internal         boolean not null default false,
  context_kind     text check (context_kind in ('arte','contrato','apadrinamiento','propuesta','compromiso')),
  context_label    text,
  attachment_path  text,
  attachment_name  text,
  attachment_size  bigint,
  created_at       timestamptz not null default now()
);
create index if not exists comments_sponsor_idx on public.comments(sponsor_id, created_at);

create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  sponsor_id   uuid not null references public.sponsors(id) on delete cascade,
  kind         text not null check (kind in ('legal','contrato','evidencia')),
  name         text not null,
  file_path    text,
  size_bytes   bigint,
  verified     boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists documents_sponsor_idx on public.documents(sponsor_id);

create table if not exists public.proposals (
  id           uuid primary key default gen_random_uuid(),
  sponsor_id   uuid not null references public.sponsors(id) on delete cascade,
  version      int not null,
  note         text not null default '',
  status       text not null default 'enviada' check (status in ('enviada','aprobada','cambios')),
  file_path    text,
  file_name    text,
  author_name  text not null default '',
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (sponsor_id, version)
);

create table if not exists public.commitment_status (
  sponsor_id      uuid not null references public.sponsors(id) on delete cascade,
  commitment_key  text not null,
  done            boolean not null default false,
  done_at         timestamptz,
  primary key (sponsor_id, commitment_key)
);

create table if not exists public.activity (
  id          bigint generated always as identity primary key,
  sponsor_id  uuid not null references public.sponsors(id) on delete cascade,
  kind        text not null,
  text        text not null,
  actor_name  text not null default '',
  internal    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists activity_created_idx on public.activity(created_at desc);

-- Prospectos comerciales (resumen del pipeline de ventas; la fuente real es HubSpot).
create table if not exists public.prospects (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  name           text not null,
  stage          text not null,
  tier           text not null,
  contact        text not null default '',
  stage_since    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers de identidad (security definer: leen profiles sin pasar por RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and kind = 'team');
$$;

create or replace function public.my_sponsor_id() returns uuid
language sql stable security definer set search_path = public as $$
  select sponsor_id from public.profiles where id = auth.uid() and kind = 'sponsor';
$$;

create or replace function public.can_see_sponsor(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_team() or s = public.my_sponsor_id();
$$;

-- Cupos (tickets) por tier: misma matriz que src/data/tiers.js.
create or replace function public.tier_ticket_capacity(t text) returns int
language sql immutable as $$
  select case t when 'Partner' then 200 when 'Unicorn' then 150 when 'Serie B' then 100
    when 'Serie A' then 80 when 'Seed' then 60 when 'Preseed' then 30 when 'Founders' then 15 else 0 end;
$$;

create or replace function public.tier_startup_capacity(t text) returns int
language sql immutable as $$
  select case t when 'Partner' then 5 when 'Unicorn' then 4 when 'Serie B' then 3
    when 'Serie A' then 2 when 'Seed' then 1 else 0 end;
$$;

create or replace function public.actor_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select full_name from public.profiles where id = auth.uid()), 'Sistema');
$$;

-- ---------------------------------------------------------------------------
-- Triggers: cupos, etapa, bitacora de actividad
-- ---------------------------------------------------------------------------

create or replace function public.enforce_attendee_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int; used int;
begin
  select public.tier_ticket_capacity(tier) into cap from public.sponsors where id = new.sponsor_id;
  -- bloqueo por patrocinador para que dos altas simultaneas no pasen el tope
  perform 1 from public.sponsors where id = new.sponsor_id for update;
  select count(*) into used from public.attendees where sponsor_id = new.sponsor_id;
  if used >= cap then
    raise exception 'CUPOS_LLENOS: el paquete incluye % cupos y ya estan todos usados', cap
      using errcode = 'P0001';
  end if;
  new.email := lower(trim(new.email));
  new.name := trim(new.name);
  return new;
end $$;
drop trigger if exists attendees_capacity on public.attendees;
create trigger attendees_capacity before insert on public.attendees
  for each row execute function public.enforce_attendee_capacity();

create or replace function public.enforce_startup_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int; used int;
begin
  select public.tier_startup_capacity(tier) into cap from public.sponsors where id = new.sponsor_id;
  perform 1 from public.sponsors where id = new.sponsor_id for update;
  select count(*) into used from public.sponsored_startups where sponsor_id = new.sponsor_id;
  if used >= cap then
    raise exception 'APADRINAMIENTOS_LLENOS: el paquete incluye % apadrinamientos', cap using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists startups_capacity on public.sponsored_startups;
create trigger startups_capacity before insert on public.sponsored_startups
  for each row execute function public.enforce_startup_capacity();

create or replace function public.sponsor_before_update() returns trigger
language plpgsql as $$
begin
  if new.stage is distinct from old.stage then new.stage_changed_at := now(); end if;
  if new.contract_status = 'Firmado' and old.contract_status is distinct from 'Firmado'
     and new.contract_signed_at is null then
    new.contract_signed_at := current_date;
  end if;
  return new;
end $$;
drop trigger if exists sponsors_before_update on public.sponsors;
create trigger sponsors_before_update before update on public.sponsors
  for each row execute function public.sponsor_before_update();

create or replace function public.log_activity(p_sponsor uuid, p_kind text, p_text text, p_internal boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into public.activity (sponsor_id, kind, text, actor_name, internal)
  values (p_sponsor, p_kind, p_text, public.actor_name(), p_internal);
$$;
revoke all on function public.log_activity(uuid, text, text, boolean) from public, anon, authenticated;

create or replace function public.stage_label(s text) returns text language sql immutable as $$
  select case s when 'kickoff' then 'Kickoff' when 'contract' then 'Contrato' when 'production' then 'Producción'
    when 'approvals' then 'Aprobaciones' when 'sponsoring' then 'Apadrinamientos'
    when 'ready' then 'Listo para evento' when 'post' then 'Post-evento' else s end;
$$;

create or replace function public.sponsor_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage is distinct from old.stage then
    perform public.log_activity(new.id, 'stage', new.name || ' pasó a ' || public.stage_label(new.stage), true);
  end if;
  if new.contract_status is distinct from old.contract_status then
    perform public.log_activity(new.id, 'contract', 'Contrato de ' || new.name || ': ' || new.contract_status);
  end if;
  if new.logo_path is distinct from old.logo_path and new.logo_path is not null then
    perform public.log_activity(new.id, 'logo', new.name || ' tiene logo cargado');
  end if;
  return null;
end $$;
drop trigger if exists sponsors_after_update on public.sponsors;
create trigger sponsors_after_update after update on public.sponsors
  for each row execute function public.sponsor_after_update();

create or replace function public.asset_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare sname text;
begin
  select name into sname from public.sponsors where id = new.sponsor_id;
  if tg_op = 'INSERT' then
    perform public.log_activity(new.sponsor_id, 'asset',
      case when new.status = 'pendiente' then 'Nueva pieza para aprobar: ' else 'Pieza en producción: ' end
      || new.name || ' (' || sname || ')');
  elsif new.status is distinct from old.status then
    perform public.log_activity(new.sponsor_id, 'asset',
      case new.status when 'aprobado' then sname || ' aprobó ' || new.name
                      when 'cambios' then sname || ' pidió cambios en ' || new.name
                      when 'pendiente' then new.name || ' enviada a aprobación de ' || sname
                      else new.name || ' volvió a producción' end);
  end if;
  return null;
end $$;
drop trigger if exists assets_activity on public.assets;
create trigger assets_activity after insert or update on public.assets
  for each row execute function public.asset_activity();

create or replace function public.comment_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare sname text;
begin
  if new.team = 'system' then return null; end if;
  select name into sname from public.sponsors where id = new.sponsor_id;
  perform public.log_activity(new.sponsor_id, 'comment',
    new.author_name || case when new.internal then ' dejó una nota interna en ' else ' escribió en ' end || sname,
    new.internal);
  return null;
end $$;
drop trigger if exists comments_activity on public.comments;
create trigger comments_activity after insert on public.comments
  for each row execute function public.comment_activity();

create or replace function public.startup_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare sname text;
begin
  select name into sname from public.sponsors where id = new.sponsor_id;
  perform public.log_activity(new.sponsor_id, 'startup', sname || ' apadrina a ' || new.name);
  return null;
end $$;
drop trigger if exists startups_activity on public.sponsored_startups;
create trigger startups_activity after insert on public.sponsored_startups
  for each row execute function public.startup_activity();

-- ---------------------------------------------------------------------------
-- Acciones del patrocinador (RPC): solo sobre su propio patrocinio
-- ---------------------------------------------------------------------------

create or replace function public.review_asset(p_asset uuid, p_decision text, p_note text default null)
returns public.assets language plpgsql security definer set search_path = public as $$
declare a public.assets; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  select * into a from public.assets where id = p_asset for update;
  if a.id is null then raise exception 'NO_EXISTE' using errcode = 'P0002'; end if;
  if not (me.kind = 'team' or a.sponsor_id = me.sponsor_id) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_decision not in ('aprobado','cambios') then raise exception 'DECISION_INVALIDA' using errcode = '22023'; end if;
  if a.status <> 'pendiente' then raise exception 'NO_ESTA_PENDIENTE' using errcode = 'P0001'; end if;
  if p_decision = 'cambios' and coalesce(trim(p_note), '') = '' then
    raise exception 'FALTA_NOTA: para pedir cambios hay que decir cuales' using errcode = '22023';
  end if;
  update public.assets set status = p_decision, reviewed_by = me.id, reviewed_at = now(),
         review_note = nullif(trim(p_note), '')
   where id = p_asset returning * into a;
  insert into public.comments (sponsor_id, author_id, author_name, author_role, team, body, context_kind, context_label)
  values (a.sponsor_id, me.id, me.full_name, me.title, case when me.kind = 'team' then 'startco' else 'sponsor' end,
          case when p_decision = 'aprobado' then 'Aprobé esta pieza.' || coalesce(' ' || nullif(trim(p_note), ''), '')
               else 'Pido cambios: ' || trim(p_note) end,
          'arte', a.name);
  return a;
end $$;

create or replace function public.review_proposal(p_proposal uuid, p_decision text, p_note text default null)
returns public.proposals language plpgsql security definer set search_path = public as $$
declare p public.proposals; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into p from public.proposals where id = p_proposal for update;
  if me.id is null or p.id is null or not (me.kind = 'team' or p.sponsor_id = me.sponsor_id) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_decision not in ('aprobada','cambios') then raise exception 'DECISION_INVALIDA' using errcode = '22023'; end if;
  if p.status <> 'enviada' then raise exception 'NO_ESTA_PENDIENTE' using errcode = 'P0001'; end if;
  if p.version <> (select max(version) from public.proposals where sponsor_id = p.sponsor_id) then
    raise exception 'VERSION_VIEJA: solo se revisa la ultima version' using errcode = 'P0001';
  end if;
  update public.proposals set status = p_decision, reviewed_at = now() where id = p_proposal returning * into p;
  insert into public.comments (sponsor_id, author_id, author_name, author_role, team, body, context_kind, context_label)
  values (p.sponsor_id, me.id, me.full_name, me.title, case when me.kind = 'team' then 'startco' else 'sponsor' end,
          case when p_decision = 'aprobada' then 'Aprobé la propuesta v' || p.version || '.'
               else 'Pido cambios en la propuesta v' || p.version || ': ' || coalesce(nullif(trim(p_note), ''), 'sin detalle') end,
          'propuesta', 'Propuesta v' || p.version);
  return p;
end $$;

create or replace function public.set_sponsor_logo(p_sponsor uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_see_sponsor(p_sponsor) then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_sponsor::text or split_part(p_path, '/', 2) <> 'logo' then
    raise exception 'RUTA_INVALIDA' using errcode = '22023';
  end if;
  update public.sponsors set logo_path = p_path where id = p_sponsor;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.events             enable row level security;
alter table public.sponsors           enable row level security;
alter table public.profiles           enable row level security;
alter table public.assets             enable row level security;
alter table public.sponsored_startups enable row level security;
alter table public.attendees          enable row level security;
alter table public.comments           enable row level security;
alter table public.documents          enable row level security;
alter table public.proposals          enable row level security;
alter table public.commitment_status  enable row level security;
alter table public.activity           enable row level security;
alter table public.prospects          enable row level security;

-- Limpia politicas previas para que el archivo se pueda volver a correr.
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- events: todos los usuarios con perfil leen; solo el equipo edita.
create policy events_read on public.events for select to authenticated
  using (public.is_team() or exists (select 1 from public.sponsors s where s.event_id = events.id and s.id = public.my_sponsor_id()));
create policy events_team_write on public.events for all to authenticated using (public.is_team()) with check (public.is_team());

-- sponsors: el equipo todo; el patrocinador solo lee el suyo (cambia su logo por RPC).
create policy sponsors_read on public.sponsors for select to authenticated using (public.can_see_sponsor(id));
create policy sponsors_team_write on public.sponsors for all to authenticated using (public.is_team()) with check (public.is_team());

-- profiles: cada uno ve el suyo, el equipo ve todos, el patrocinador ve al equipo y a su gente.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_team() or kind = 'team' or sponsor_id = public.my_sponsor_id());
create policy profiles_team_write on public.profiles for all to authenticated using (public.is_team()) with check (public.is_team());

-- assets: el patrocinador ve las suyas que ya le enviaron (no las que siguen en produccion interna).
create policy assets_read on public.assets for select to authenticated
  using (public.is_team() or (sponsor_id = public.my_sponsor_id() and status <> 'produccion'));
create policy assets_team_write on public.assets for all to authenticated using (public.is_team()) with check (public.is_team());

-- startups apadrinadas: el patrocinador las ve y las propone (alta y baja).
create policy startups_read on public.sponsored_startups for select to authenticated using (public.can_see_sponsor(sponsor_id));
create policy startups_insert on public.sponsored_startups for insert to authenticated with check (public.can_see_sponsor(sponsor_id));
create policy startups_delete on public.sponsored_startups for delete to authenticated using (public.can_see_sponsor(sponsor_id));
create policy startups_team_update on public.sponsored_startups for update to authenticated using (public.is_team()) with check (public.is_team());

-- inscritos: el patrocinador administra los suyos (alta, edicion, baja).
create policy attendees_read on public.attendees for select to authenticated using (public.can_see_sponsor(sponsor_id));
create policy attendees_insert on public.attendees for insert to authenticated with check (public.can_see_sponsor(sponsor_id));
create policy attendees_update on public.attendees for update to authenticated
  using (public.can_see_sponsor(sponsor_id)) with check (public.can_see_sponsor(sponsor_id));
create policy attendees_delete on public.attendees for delete to authenticated using (public.can_see_sponsor(sponsor_id));

-- comentarios: notas internas solo para el equipo; cada quien escribe con su propia identidad.
create policy comments_read on public.comments for select to authenticated
  using (public.is_team() or (sponsor_id = public.my_sponsor_id() and not internal));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = auth.uid() and public.can_see_sponsor(sponsor_id) and (
      (public.is_team() and team = 'startco') or
      (not public.is_team() and team = 'sponsor' and not internal)
    ));

-- documentos: el patrocinador ve los suyos y sube documentos legales.
create policy documents_read on public.documents for select to authenticated using (public.can_see_sponsor(sponsor_id));
create policy documents_sponsor_insert on public.documents for insert to authenticated
  with check (public.can_see_sponsor(sponsor_id) and (public.is_team() or (kind = 'legal' and not verified)));
create policy documents_team_write on public.documents for update to authenticated using (public.is_team()) with check (public.is_team());
create policy documents_team_delete on public.documents for delete to authenticated using (public.is_team());

create policy proposals_read on public.proposals for select to authenticated using (public.can_see_sponsor(sponsor_id));
create policy proposals_team_write on public.proposals for all to authenticated using (public.is_team()) with check (public.is_team());

create policy commitments_read on public.commitment_status for select to authenticated using (public.can_see_sponsor(sponsor_id));
create policy commitments_team_write on public.commitment_status for all to authenticated using (public.is_team()) with check (public.is_team());

create policy activity_read on public.activity for select to authenticated
  using (public.is_team() or (sponsor_id = public.my_sponsor_id() and not internal));

create policy prospects_team on public.prospects for all to authenticated using (public.is_team()) with check (public.is_team());

-- anon no ve nada; authenticated pasa por las politicas de arriba.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.review_asset(uuid, text, text), public.review_proposal(uuid, text, text),
  public.set_sponsor_logo(uuid, text), public.is_team(), public.my_sponsor_id(), public.can_see_sponsor(uuid),
  public.tier_ticket_capacity(text), public.tier_startup_capacity(text) to authenticated;

-- Bucket privado para archivos de patrocinadores: <sponsor_id>/<carpeta>/<archivo>.
-- El equipo lee y escribe todo; el patrocinador solo dentro de su carpeta.

insert into storage.buckets (id, name, public, file_size_limit)
values ('sponsor-files', 'sponsor-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists sponsor_files_read on storage.objects;
drop policy if exists sponsor_files_insert on storage.objects;
drop policy if exists sponsor_files_update on storage.objects;
drop policy if exists sponsor_files_delete on storage.objects;

create policy sponsor_files_read on storage.objects for select to authenticated
  using (bucket_id = 'sponsor-files' and (
    public.is_team() or (storage.foldername(name))[1] = public.my_sponsor_id()::text));

-- El patrocinador sube logo, documentos legales, adjuntos de chat; nunca contratos ni piezas.
create policy sponsor_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsor-files' and (
    public.is_team() or (
      (storage.foldername(name))[1] = public.my_sponsor_id()::text
      and (storage.foldername(name))[2] in ('logo', 'legal', 'chat'))));

create policy sponsor_files_update on storage.objects for update to authenticated
  using (bucket_id = 'sponsor-files' and public.is_team()) with check (bucket_id = 'sponsor-files' and public.is_team());

create policy sponsor_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sponsor-files' and public.is_team());

-- Toda ruta de archivo vive en <sponsor_id>/<carpeta>/: una fila nunca puede apuntar al
-- archivo de otro patrocinador ni a una carpeta que no le corresponde.

alter table public.documents drop constraint if exists documents_path_ok;
alter table public.documents add constraint documents_path_ok check (
  file_path is null or (split_part(file_path, '/', 1) = sponsor_id::text and split_part(file_path, '/', 2) = kind));

alter table public.assets drop constraint if exists assets_path_ok;
alter table public.assets add constraint assets_path_ok check (
  file_path is null or (split_part(file_path, '/', 1) = sponsor_id::text and split_part(file_path, '/', 2) = 'piezas'));

alter table public.proposals drop constraint if exists proposals_path_ok;
alter table public.proposals add constraint proposals_path_ok check (
  file_path is null or (split_part(file_path, '/', 1) = sponsor_id::text and split_part(file_path, '/', 2) = 'propuesta'));

alter table public.comments drop constraint if exists comments_path_ok;
alter table public.comments add constraint comments_path_ok check (
  attachment_path is null or (split_part(attachment_path, '/', 1) = sponsor_id::text and split_part(attachment_path, '/', 2) = 'chat'));

alter table public.sponsors drop constraint if exists sponsors_logo_path_ok;
alter table public.sponsors add constraint sponsors_logo_path_ok check (
  logo_path is null or (split_part(logo_path, '/', 1) = id::text and split_part(logo_path, '/', 2) = 'logo'));

-- Cámara de comercio: antes era texto libre y "Requisitos" lo marcaba con /vigente/i,
-- que matchea tambien "No vigente". Pasa a ser un estado fijo.

update public.sponsors set legal_cc_status = 'Por validar'
  where legal_cc_status not in ('', 'Vigente', 'Vencida', 'Por validar');

alter table public.sponsors drop constraint if exists sponsors_legal_cc_status_ok;
alter table public.sponsors add constraint sponsors_legal_cc_status_ok
  check (legal_cc_status in ('', 'Vigente', 'Vencida', 'Por validar'));

-- Multitenant: mas de un organizador (ademas de StartCo) puede usar la misma app, cada
-- uno sin ver nada del otro. Hasta aca "equipo" significaba "cualquier is_team()", sin
-- distinguir de que organizador - este archivo agrega esa distincion en todas las capas:
-- tablas, RLS, Storage y las funciones security definer (que no pasan por RLS).
--
-- Pensado para correr sobre una base ya viva (no solo el demo): las columnas nuevas entran
-- nullable, se rellenan para los datos existentes, y recien ahi se vuelven NOT NULL en dos
-- pasos (check not valid + validate) para no bloquear la tabla con un scan largo.

-- ---------------------------------------------------------------------------
-- 1. Tabla organizations, con su propia RLS desde el dia uno
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.organizations enable row level security;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organizations to service_role;

-- Organizacion default para los datos que ya existen (StartCo). Id fijo para que el
-- backfill de abajo sea idempotente si este archivo se vuelve a correr.
insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'StartCo', 'startco')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. organization_id en las tablas raiz (profiles, events) y denormalizado en
--    sponsors (via trigger, para que las politicas comparen una columna y no
--    tengan que hacer join con events en cada chequeo).
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists organization_id uuid;
alter table public.events   add column if not exists organization_id uuid;
alter table public.sponsors add column if not exists organization_id uuid;

update public.profiles set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.events   set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.sponsors set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;

-- FK en dos pasos: "not valid" no bloquea, "validate" escanea sin tomar el lock fuerte.
alter table public.profiles drop constraint if exists profiles_org_fk;
alter table public.profiles add constraint profiles_org_fk foreign key (organization_id) references public.organizations(id) not valid;
alter table public.profiles validate constraint profiles_org_fk;

alter table public.events drop constraint if exists events_org_fk;
alter table public.events add constraint events_org_fk foreign key (organization_id) references public.organizations(id) not valid;
alter table public.events validate constraint events_org_fk;

alter table public.sponsors drop constraint if exists sponsors_org_fk;
alter table public.sponsors add constraint sponsors_org_fk foreign key (organization_id) references public.organizations(id) not valid;
alter table public.sponsors validate constraint sponsors_org_fk;

-- NOT NULL en dos pasos (mismo motivo): un check "not valid" + validate deja que el
-- "set not null" final sea instantaneo (Postgres 12+ no vuelve a escanear la tabla).
alter table public.profiles drop constraint if exists profiles_org_not_null;
alter table public.profiles add constraint profiles_org_not_null check (organization_id is not null) not valid;
alter table public.profiles validate constraint profiles_org_not_null;
alter table public.profiles alter column organization_id set not null;
alter table public.profiles drop constraint profiles_org_not_null;

alter table public.events drop constraint if exists events_org_not_null;
alter table public.events add constraint events_org_not_null check (organization_id is not null) not valid;
alter table public.events validate constraint events_org_not_null;
alter table public.events alter column organization_id set not null;
alter table public.events drop constraint events_org_not_null;

alter table public.sponsors drop constraint if exists sponsors_org_not_null;
alter table public.sponsors add constraint sponsors_org_not_null check (organization_id is not null) not valid;
alter table public.sponsors validate constraint sponsors_org_not_null;
alter table public.sponsors alter column organization_id set not null;
alter table public.sponsors drop constraint sponsors_org_not_null;

create index if not exists profiles_org_idx on public.profiles(organization_id);
create index if not exists events_org_idx   on public.events(organization_id);
create index if not exists sponsors_org_idx on public.sponsors(organization_id);

-- ---------------------------------------------------------------------------
-- 3. Triggers: organization_id no se confia de quien llama, se deriva solo.
--    sponsors la toma de su event_id; profiles (los de kind='sponsor') la toma
--    de su sponsor_id. Los profiles de kind='team' la reciben tal cual al
--    crearse (no hay de donde derivarla: son el primer usuario de su org).
-- ---------------------------------------------------------------------------

create or replace function public.sponsor_org_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select organization_id into new.organization_id from public.events where id = new.event_id;
  return new;
end $$;
drop trigger if exists sponsors_org_sync on public.sponsors;
create trigger sponsors_org_sync before insert or update of event_id on public.sponsors
  for each row execute function public.sponsor_org_sync();

create or replace function public.profile_org_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'sponsor' then
    select organization_id into new.organization_id from public.sponsors where id = new.sponsor_id;
  end if;
  return new;
end $$;
drop trigger if exists profiles_org_sync on public.profiles;
create trigger profiles_org_sync before insert or update of sponsor_id on public.profiles
  for each row execute function public.profile_org_sync();

-- ---------------------------------------------------------------------------
-- 4. Helpers: my_org_id() nueva, can_see_sponsor() ahora exige misma organizacion.
--    Null-safe igual que is_team()/my_sponsor_id(): sin fila de perfil, devuelve
--    null y todo lo que compara contra null cierra en "no autorizado", no en error.
-- ---------------------------------------------------------------------------

create or replace function public.my_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.can_see_sponsor(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sponsors sp
    where sp.id = s and sp.organization_id = public.my_org_id()
      and (public.is_team() or sp.id = public.my_sponsor_id())
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Politicas: todo lo que ya enruta por can_see_sponsor(sponsor_id) queda
--    arreglado gratis con el cambio de arriba (sponsors_read, attendees_*,
--    startups_read/insert/delete, documents_read/sponsor_insert, proposals_read,
--    commitments_read). Lo que sigue son las que usaban is_team() a secas, sin
--    ningun chequeo de organizacion - la lista completa que encontramos en el
--    code review (lectura y escritura, mas storage y los 3 RPC mas abajo).
-- ---------------------------------------------------------------------------

create policy organizations_read on public.organizations for select to authenticated
  using (id = public.my_org_id());

drop policy if exists events_read on public.events;
create policy events_read on public.events for select to authenticated
  using (organization_id = public.my_org_id() and (public.is_team() or exists (select 1 from public.sponsors s where s.event_id = events.id and s.id = public.my_sponsor_id())));

drop policy if exists events_team_write on public.events;
create policy events_team_write on public.events for all to authenticated
  using (public.is_team() and organization_id = public.my_org_id()) with check (public.is_team() and organization_id = public.my_org_id());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or (organization_id = public.my_org_id() and (public.is_team() or kind = 'team' or sponsor_id = public.my_sponsor_id())));

drop policy if exists profiles_team_write on public.profiles;
create policy profiles_team_write on public.profiles for all to authenticated
  using (public.is_team() and organization_id = public.my_org_id()) with check (public.is_team() and organization_id = public.my_org_id());

drop policy if exists assets_read on public.assets;
create policy assets_read on public.assets for select to authenticated
  using (public.can_see_sponsor(sponsor_id) and (public.is_team() or status <> 'produccion'));

drop policy if exists assets_team_write on public.assets;
create policy assets_team_write on public.assets for all to authenticated
  using (public.is_team() and public.can_see_sponsor(sponsor_id)) with check (public.is_team() and public.can_see_sponsor(sponsor_id));

drop policy if exists startups_team_update on public.sponsored_startups;
create policy startups_team_update on public.sponsored_startups for update to authenticated
  using (public.is_team() and public.can_see_sponsor(sponsor_id)) with check (public.is_team() and public.can_see_sponsor(sponsor_id));

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated
  using (public.can_see_sponsor(sponsor_id) and (public.is_team() or not internal));

drop policy if exists documents_team_write on public.documents;
create policy documents_team_write on public.documents for update to authenticated
  using (public.is_team() and public.can_see_sponsor(sponsor_id)) with check (public.is_team() and public.can_see_sponsor(sponsor_id));

drop policy if exists documents_team_delete on public.documents;
create policy documents_team_delete on public.documents for delete to authenticated
  using (public.is_team() and public.can_see_sponsor(sponsor_id));

drop policy if exists proposals_team_write on public.proposals;
create policy proposals_team_write on public.proposals for all to authenticated
  using (public.is_team() and public.can_see_sponsor(sponsor_id)) with check (public.is_team() and public.can_see_sponsor(sponsor_id));

drop policy if exists commitments_team_write on public.commitment_status;
create policy commitments_team_write on public.commitment_status for all to authenticated
  using (public.is_team() and public.can_see_sponsor(sponsor_id)) with check (public.is_team() and public.can_see_sponsor(sponsor_id));

drop policy if exists activity_read on public.activity;
create policy activity_read on public.activity for select to authenticated
  using (public.can_see_sponsor(sponsor_id) and (public.is_team() or not internal));

drop policy if exists prospects_team on public.prospects;
create policy prospects_team on public.prospects for all to authenticated
  using (public.is_team() and exists (select 1 from public.events e where e.id = prospects.event_id and e.organization_id = public.my_org_id()))
  with check (public.is_team() and exists (select 1 from public.events e where e.id = prospects.event_id and e.organization_id = public.my_org_id()));

-- ---------------------------------------------------------------------------
-- 6. Storage: mismas 4 politicas de 0002_storage.sql, con el chequeo de
--    organizacion agregado solo en la rama de equipo (is_team()). Comparacion
--    como texto -- nunca castear el segmento del path a uuid, porque un path
--    con formato invalido tiraria un error en vez de simplemente denegar.
-- ---------------------------------------------------------------------------

drop policy if exists sponsor_files_read on storage.objects;
create policy sponsor_files_read on storage.objects for select to authenticated
  using (bucket_id = 'sponsor-files' and (
    (public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(name))[1]))
    or (storage.foldername(name))[1] = public.my_sponsor_id()::text));

drop policy if exists sponsor_files_insert on storage.objects;
create policy sponsor_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsor-files' and (
    (public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(name))[1]))
    or (
      (storage.foldername(name))[1] = public.my_sponsor_id()::text
      and (storage.foldername(name))[2] in ('logo', 'legal', 'chat'))));

drop policy if exists sponsor_files_update on storage.objects;
create policy sponsor_files_update on storage.objects for update to authenticated
  using (bucket_id = 'sponsor-files' and public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(name))[1]))
  with check (bucket_id = 'sponsor-files' and public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(name))[1]));

drop policy if exists sponsor_files_delete on storage.objects;
create policy sponsor_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sponsor-files' and public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- 7. RPCs security definer: no pasan por RLS en sus propios updates, asi que
--    el chequeo de organizacion tiene que estar adentro de la funcion. Las dos
--    reimplementan su autorizacion a mano con "me.kind='team' or sponsor_id=
--    me.sponsor_id" (sin organizacion); las reemplazo para que llamen a
--    can_see_sponsor(), que ya quedo org-aware arriba. set_sponsor_logo ya
--    llamaba a can_see_sponsor() - queda arreglada sin tocarla.
-- ---------------------------------------------------------------------------

create or replace function public.review_asset(p_asset uuid, p_decision text, p_note text default null)
returns public.assets language plpgsql security definer set search_path = public as $$
declare a public.assets; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  select * into a from public.assets where id = p_asset for update;
  if a.id is null then raise exception 'NO_EXISTE' using errcode = 'P0002'; end if;
  if not public.can_see_sponsor(a.sponsor_id) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_decision not in ('aprobado','cambios') then raise exception 'DECISION_INVALIDA' using errcode = '22023'; end if;
  if a.status <> 'pendiente' then raise exception 'NO_ESTA_PENDIENTE' using errcode = 'P0001'; end if;
  if p_decision = 'cambios' and coalesce(trim(p_note), '') = '' then
    raise exception 'FALTA_NOTA: para pedir cambios hay que decir cuales' using errcode = '22023';
  end if;
  update public.assets set status = p_decision, reviewed_by = me.id, reviewed_at = now(),
         review_note = nullif(trim(p_note), '')
   where id = p_asset returning * into a;
  insert into public.comments (sponsor_id, author_id, author_name, author_role, team, body, context_kind, context_label)
  values (a.sponsor_id, me.id, me.full_name, me.title, case when me.kind = 'team' then 'startco' else 'sponsor' end,
          case when p_decision = 'aprobado' then 'Aprobé esta pieza.' || coalesce(' ' || nullif(trim(p_note), ''), '')
               else 'Pido cambios: ' || trim(p_note) end,
          'arte', a.name);
  return a;
end $$;

create or replace function public.review_proposal(p_proposal uuid, p_decision text, p_note text default null)
returns public.proposals language plpgsql security definer set search_path = public as $$
declare p public.proposals; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into p from public.proposals where id = p_proposal for update;
  if me.id is null or p.id is null or not public.can_see_sponsor(p.sponsor_id) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_decision not in ('aprobada','cambios') then raise exception 'DECISION_INVALIDA' using errcode = '22023'; end if;
  if p.status <> 'enviada' then raise exception 'NO_ESTA_PENDIENTE' using errcode = 'P0001'; end if;
  if p.version <> (select max(version) from public.proposals where sponsor_id = p.sponsor_id) then
    raise exception 'VERSION_VIEJA: solo se revisa la ultima version' using errcode = 'P0001';
  end if;
  update public.proposals set status = p_decision, reviewed_at = now() where id = p_proposal returning * into p;
  insert into public.comments (sponsor_id, author_id, author_name, author_role, team, body, context_kind, context_label)
  values (p.sponsor_id, me.id, me.full_name, me.title, case when me.kind = 'team' then 'startco' else 'sponsor' end,
          case when p_decision = 'aprobada' then 'Aprobé la propuesta v' || p.version || '.'
               else 'Pido cambios en la propuesta v' || p.version || ': ' || coalesce(nullif(trim(p_note), ''), 'sin detalle') end,
          'propuesta', 'Propuesta v' || p.version);
  return p;
end $$;

grant execute on function public.my_org_id() to authenticated;

-- 0005_multitenant.sql reescribio sponsors_read para que use can_see_sponsor(id) (ya quedo
-- org-aware), pero nunca toco sponsors_team_write: siguio siendo "is_team()" a secas, sin
-- organization_id. Como las politicas RLS se combinan con OR, esa sola bastaba para que
-- cualquier equipo de cualquier organizacion viera y editara los sponsors de las demas -
-- encontrado con rls-check.mjs al correr el bloque de aislamiento cruzado (create-org.mjs).

drop policy if exists sponsors_team_write on public.sponsors;
create policy sponsors_team_write on public.sponsors for all to authenticated
  using (public.is_team() and organization_id = public.my_org_id())
  with check (public.is_team() and organization_id = public.my_org_id());

-- Generado por scripts/build-seed.mjs. No editar a mano.
-- Borra y vuelve a cargar los datos de ejemplo (no toca usuarios ni perfiles del equipo).
begin;
delete from public.assets where sponsor_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000107');
delete from public.sponsored_startups where sponsor_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000107');
delete from public.attendees where sponsor_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000107');
delete from public.comments where sponsor_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000107');
delete from public.documents where sponsor_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000107');
delete from public.proposals where sponsor_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000107');
delete from public.commitment_status where sponsor_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000107');
delete from public.activity where sponsor_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000107');
delete from public.prospects where event_id = '00000000-0000-4000-8000-000000000001';
insert into public.events (id, organization_id, name, city, venue, start_date, end_date) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'StartCo 2026', 'Medellín', 'Plaza Mayor Medellín', current_date + 47, current_date + 48)
  on conflict (id) do update set organization_id = excluded.organization_id, name = excluded.name, city = excluded.city, venue = excluded.venue, start_date = excluded.start_date, end_date = excluded.end_date;
insert into public.prospects (event_id, name, stage, tier, contact, stage_since) values ('00000000-0000-4000-8000-000000000001', 'Tigo Une', 'Negociación', 'Serie A', 'Diana Marcela Pérez', now() - interval '6 days');
insert into public.prospects (event_id, name, stage, tier, contact, stage_since) values ('00000000-0000-4000-8000-000000000001', 'Davivienda', 'Propuesta', 'Seed', 'Carolina Mejía', now() - interval '3 days');
insert into public.prospects (event_id, name, stage, tier, contact, stage_since) values ('00000000-0000-4000-8000-000000000001', 'Postobón', 'Prospección', 'Preseed', 'Juan Pablo Vélez', now() - interval '11 days');

-- Bancolombia
insert into public.sponsors (id, event_id, name, initials, tier, stage, stage_changed_at, value_cop, sector, contact_name, contact_role, contact_email, contact_phone, legal_razon, legal_rut, legal_domicilio, legal_cc_status, hubspot_contacts, hubspot_segments, contract_type, contract_status, contract_signed_at, logo_path, nps, nps_quote, social_views) values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Bancolombia', 'BC', 'Partner', 'approvals', now() - interval '4 days', 250000000, 'Servicios Financieros', 'María Camila Restrepo', 'Directora Innovación', 'mcamila.restrepo@bancolombia.example', '+57 300 555 1122', 'Bancolombia S.A.', '890.903.938-8', 'Medellín', 'Vigente', 7, array['Marca','Patrocinios','Innovación']::text[], 'Cliente', 'Firmado', current_date - 30, '00000000-0000-4000-8000-000000000101/logo/seed-logo', null, null, null)
  on conflict (id) do update set event_id = excluded.event_id, name = excluded.name, initials = excluded.initials, tier = excluded.tier, stage = excluded.stage, stage_changed_at = excluded.stage_changed_at, value_cop = excluded.value_cop, sector = excluded.sector, contact_name = excluded.contact_name, contact_role = excluded.contact_role, contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, legal_razon = excluded.legal_razon, legal_rut = excluded.legal_rut, legal_domicilio = excluded.legal_domicilio, legal_cc_status = excluded.legal_cc_status, hubspot_contacts = excluded.hubspot_contacts, hubspot_segments = excluded.hubspot_segments, contract_type = excluded.contract_type, contract_status = excluded.contract_status, contract_signed_at = excluded.contract_signed_at, logo_path = excluded.logo_path, nps = excluded.nps, nps_quote = excluded.nps_quote, social_views = excluded.social_views;
update public.sponsors set stage_changed_at = now() - interval '4 days' where id = '00000000-0000-4000-8000-000000000101';
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000101', 'Pieza redes sociales: Día 1', 'aprobado', (date_trunc('day', now()) - interval '7 days' + time '10:00'), (date_trunc('day', now()) - interval '6 days' + time '15:00'), (date_trunc('day', now()) - interval '8 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000101', 'Render stand 20 m²', 'pendiente', (date_trunc('day', now()) - interval '3 days' + time '10:00'), null, (date_trunc('day', now()) - interval '4 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000101', 'Cápsula video colaborativo', 'pendiente', (date_trunc('day', now()) - interval '2 days' + time '10:00'), null, (date_trunc('day', now()) - interval '3 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000101', 'Imagen escarapela', 'aprobado', (date_trunc('day', now()) - interval '10 days' + time '10:00'), (date_trunc('day', now()) - interval '9 days' + time '15:00'), (date_trunc('day', now()) - interval '11 days' + time '09:00'));
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000101', 'Truora', 'KYC');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000101', 'Habi', 'PropTech');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000101', 'Frubana', 'AgriFood');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000101', 'Liftit', 'Logística');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000101', 'Merqueo', 'eGrocery');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Catalina Correa', 'catalina.correa@bancolombia.example', 'Strategy Lead', 'both', 'confirmado', now() - interval '0 days' - interval '15 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Pablo Hincapié', 'pablo.hincapie@bancolombia.example', 'BD Manager', 'd1', 'confirmado', now() - interval '1 days' - interval '14 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Valentina Martínez', 'valentina.martinez@bancolombia.example', 'Product Manager', 'd2', 'confirmado', now() - interval '2 days' - interval '18 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Tomás Ospina', 'tomas.ospina@bancolombia.example', 'Marketing Director', 'both', 'confirmado', now() - interval '4 days' - interval '12 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Adriana Pérez', 'adriana.perez@bancolombia.example', 'Brand Manager', 'both', 'confirmado', now() - interval '7 days' - interval '13 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Mateo Salazar', 'mateo.salazar@bancolombia.example', 'Innovation Lead', 'd1', 'confirmado', now() - interval '14 days' - interval '13 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Luisa Flores', 'luisa.flores@bancolombia.example', 'Finance Director', 'd2', 'confirmado', now() - interval '21 days' - interval '12 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Carlos Moreno', 'carlos.moreno@bancolombia.example', 'Customer Success', 'both', 'confirmado', now() - interval '0 days' - interval '13 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Isabela Posada', 'isabela.posada@bancolombia.example', 'Head of Growth', 'd1', 'confirmado', now() - interval '0 days' - interval '14 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Daniel García', 'daniel.garcia@bancolombia.example', 'VP Engineering', 'd2', 'confirmado', now() - interval '1 days' - interval '13 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Ana Jaramillo', 'ana.jaramillo@bancolombia.example', 'Platform Lead', 'both', 'confirmado', now() - interval '2 days' - interval '13 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Alejandro López', 'alejandro.lopez@bancolombia.example', 'UX Lead', 'd1', 'confirmado', now() - interval '4 days' - interval '15 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Ximena Echavarría', 'ximena.echavarria@bancolombia.example', 'Data Lead', 'd2', 'confirmado', now() - interval '7 days' - interval '17 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Felipe Torres', 'felipe.torres@bancolombia.example', 'Open Innovation Lead', 'both', 'invitado', now() - interval '14 days' - interval '13 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Paula Álvarez', 'paula.alvarez@bancolombia.example', 'Sales Director', 'both', 'invitado', now() - interval '21 days' - interval '13 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000101', 'Ricardo Mejía', 'ricardo.mejia@bancolombia.example', 'Operations', 'd1', 'invitado', now() - interval '0 days' - interval '13 hours');
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000101', 'JuanGa', 'Comercial', 'startco', '¡Hola, María Camila! Subimos el render del stand de 20 m². Cuando puedas, échale un ojo y nos confirmas para mandarlo a producción.', 'arte', 'Render stand 20 m²', null, null, (date_trunc('day', now()) - interval '3 days' + time '10:14'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000101', 'María Camila Restrepo', 'Bancolombia', 'sponsor', 'Recibido, Juan, lo veo hoy mismo. Una pregunta rápida: ¿el área de la barra de café está incluida en los 20 m² o es aparte?', null, null, null, null, (date_trunc('day', now()) - interval '3 days' + time '14:32'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000101', 'Carolina (Diseño)', 'Diseño', 'startco', 'Hola, María Camila: la barra está incluida. Te dejo el plano en alta resolución para que lo veas con el equipo.', null, null, 'plano_stand_v2.pdf', 1258291, (date_trunc('day', now()) - interval '3 days' + time '14:48'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000101', 'María Camila Restrepo', 'Bancolombia', 'sponsor', 'Perfecto. La pieza de redes del Día 1 ya quedó aprobada. Reviso el render con el equipo y lo apruebo desde el portal. Sigo esperando el guion de la cápsula.', null, null, null, null, (date_trunc('day', now()) - interval '2 days' + time '09:05'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000101', 'JuanGa', 'Comercial', 'startco', 'Listo, hoy en la tarde te paso el guion de la cápsula y la pieza de redes del Día 2. Gracias por la rapidez.', null, null, null, null, (date_trunc('day', now()) - interval '2 days' + time '09:12'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000101', 1, 'Propuesta inicial enviada al cliente.', 'cambios', 'JuanGa', (date_trunc('day', now()) - interval '54 days' + time '09:00'), (date_trunc('day', now()) - interval '56 days' + time '09:00'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000101', 2, 'Ajuste: apadrinamientos extra solicitados por el cliente.', 'cambios', 'JuanGa', (date_trunc('day', now()) - interval '61 days' + time '09:00'), (date_trunc('day', now()) - interval '63 days' + time '09:00'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000101', 3, 'Versión final con descuento del 15%.', 'aprobada', 'JuanGa', (date_trunc('day', now()) - interval '68 days' + time '09:00'), (date_trunc('day', now()) - interval '70 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000101', 'legal', 'RUT_BC.pdf', 191370, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000101', 'legal', 'Camara_comercio_BC.pdf', 301014, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000101', 'legal', 'Cert_bancario_BC.pdf', 282740, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000101', 'contrato', 'Contrato_BC_firmado.pdf', 412000, true, current_date - 30);

-- Grupo Energía Bogotá
insert into public.sponsors (id, event_id, name, initials, tier, stage, stage_changed_at, value_cop, sector, contact_name, contact_role, contact_email, contact_phone, legal_razon, legal_rut, legal_domicilio, legal_cc_status, hubspot_contacts, hubspot_segments, contract_type, contract_status, contract_signed_at, logo_path, nps, nps_quote, social_views) values ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Grupo Energía Bogotá', 'GEB', 'Unicorn', 'sponsoring', now() - interval '5 days', 166000000, 'Energía', 'Andrés Felipe Cárdenas', 'Gerente de Innovación', 'afcardenas@geb.example', '+57 310 222 8899', 'Grupo Energía Bogotá S.A. ESP', '899.999.082-3', 'Bogotá', 'Vigente', 5, array['Energytech','Patrocinios']::text[], 'StartCo', 'Firmado', current_date - 35, '00000000-0000-4000-8000-000000000102/logo/seed-logo', null, null, null)
  on conflict (id) do update set event_id = excluded.event_id, name = excluded.name, initials = excluded.initials, tier = excluded.tier, stage = excluded.stage, stage_changed_at = excluded.stage_changed_at, value_cop = excluded.value_cop, sector = excluded.sector, contact_name = excluded.contact_name, contact_role = excluded.contact_role, contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, legal_razon = excluded.legal_razon, legal_rut = excluded.legal_rut, legal_domicilio = excluded.legal_domicilio, legal_cc_status = excluded.legal_cc_status, hubspot_contacts = excluded.hubspot_contacts, hubspot_segments = excluded.hubspot_segments, contract_type = excluded.contract_type, contract_status = excluded.contract_status, contract_signed_at = excluded.contract_signed_at, logo_path = excluded.logo_path, nps = excluded.nps, nps_quote = excluded.nps_quote, social_views = excluded.social_views;
update public.sponsors set stage_changed_at = now() - interval '5 days' where id = '00000000-0000-4000-8000-000000000102';
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000102', 'Pieza redes: convocatoria Stars Up', 'aprobado', (date_trunc('day', now()) - interval '15 days' + time '10:00'), (date_trunc('day', now()) - interval '14 days' + time '15:00'), (date_trunc('day', now()) - interval '16 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000102', 'Render stand 16 m²', 'aprobado', (date_trunc('day', now()) - interval '13 days' + time '10:00'), (date_trunc('day', now()) - interval '12 days' + time '15:00'), (date_trunc('day', now()) - interval '14 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000102', 'Pieza Newsletter #1', 'aprobado', (date_trunc('day', now()) - interval '11 days' + time '10:00'), (date_trunc('day', now()) - interval '10 days' + time '15:00'), (date_trunc('day', now()) - interval '12 days' + time '09:00'));
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000102', 'SPACE AG', 'AgriEnergy');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000102', 'Hooil', 'CleanTech');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000102', 'Volt', 'Movilidad');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000102', 'EcoSmart', 'Eficiencia');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Samuel Torres', 'samuel.torres@grupoenergiabogota.example', 'Operations', 'd1', 'confirmado', now() - interval '1 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Laura Álvarez', 'laura.alvarez@grupoenergiabogota.example', 'Partnerships', 'd2', 'confirmado', now() - interval '2 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Nicolás Mejía', 'nicolas.mejia@grupoenergiabogota.example', 'Digital Lead', 'both', 'confirmado', now() - interval '4 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Sara Gómez', 'sara.gomez@grupoenergiabogota.example', 'CMO', 'both', 'confirmado', now() - interval '7 days' - interval '17 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Diego Vélez', 'diego.velez@grupoenergiabogota.example', 'CFO', 'd1', 'confirmado', now() - interval '14 days' - interval '18 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Catalina Hernández', 'catalina.hernandez@grupoenergiabogota.example', 'Strategy Lead', 'd2', 'confirmado', now() - interval '21 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Pablo Arango', 'pablo.arango@grupoenergiabogota.example', 'BD Manager', 'both', 'confirmado', now() - interval '0 days' - interval '19 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Valentina Ramírez', 'valentina.ramirez@grupoenergiabogota.example', 'Product Manager', 'd1', 'confirmado', now() - interval '0 days' - interval '4 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Tomás Quintero', 'tomas.quintero@grupoenergiabogota.example', 'Marketing Director', 'd2', 'confirmado', now() - interval '1 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Adriana Cárdenas', 'adriana.cardenas@grupoenergiabogota.example', 'Brand Manager', 'both', 'confirmado', now() - interval '2 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Mateo Restrepo', 'mateo.restrepo@grupoenergiabogota.example', 'Innovation Lead', 'd1', 'confirmado', now() - interval '4 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Luisa Ortiz', 'luisa.ortiz@grupoenergiabogota.example', 'Finance Director', 'd2', 'confirmado', now() - interval '7 days' - interval '18 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Carlos Rodríguez', 'carlos.rodriguez@grupoenergiabogota.example', 'Customer Success', 'both', 'confirmado', now() - interval '14 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Isabela Henao', 'isabela.henao@grupoenergiabogota.example', 'Head of Growth', 'both', 'confirmado', now() - interval '21 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Daniel Sánchez', 'daniel.sanchez@grupoenergiabogota.example', 'VP Engineering', 'd1', 'confirmado', now() - interval '0 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Ana Castaño', 'ana.castano@grupoenergiabogota.example', 'Platform Lead', 'd2', 'confirmado', now() - interval '0 days' - interval '18 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Alejandro Rivera', 'alejandro.rivera@grupoenergiabogota.example', 'UX Lead', 'both', 'confirmado', now() - interval '1 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Ximena Correa', 'ximena.correa@grupoenergiabogota.example', 'Data Lead', 'd1', 'confirmado', now() - interval '2 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Felipe Hincapié', 'felipe.hincapie@grupoenergiabogota.example', 'Open Innovation Lead', 'd2', 'confirmado', now() - interval '4 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Paula Martínez', 'paula.martinez@grupoenergiabogota.example', 'Sales Director', 'both', 'confirmado', now() - interval '7 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Ricardo Ospina', 'ricardo.ospina@grupoenergiabogota.example', 'Operations', 'd1', 'confirmado', now() - interval '14 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Daniela Pérez', 'daniela.perez@grupoenergiabogota.example', 'Partnerships', 'd2', 'confirmado', now() - interval '21 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'David Salazar', 'david.salazar@grupoenergiabogota.example', 'Digital Lead', 'both', 'confirmado', now() - interval '0 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'María Flores', 'maria.flores@grupoenergiabogota.example', 'CMO', 'both', 'confirmado', now() - interval '0 days' - interval '19 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Santiago Moreno', 'santiago.moreno@grupoenergiabogota.example', 'CFO', 'd1', 'confirmado', now() - interval '1 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Natalia Posada', 'natalia.posada@grupoenergiabogota.example', 'Strategy Lead', 'd2', 'confirmado', now() - interval '2 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Juan García', 'juan.garcia@grupoenergiabogota.example', 'BD Manager', 'both', 'confirmado', now() - interval '4 days' - interval '18 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Mariana Jaramillo', 'mariana.jaramillo@grupoenergiabogota.example', 'Product Manager', 'd1', 'confirmado', now() - interval '7 days' - interval '4 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Gabriel López', 'gabriel.lopez@grupoenergiabogota.example', 'Marketing Director', 'd2', 'confirmado', now() - interval '14 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Camila Echavarría', 'camila.echavarria@grupoenergiabogota.example', 'Brand Manager', 'both', 'confirmado', now() - interval '21 days' - interval '4 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Esteban Torres', 'esteban.torres@grupoenergiabogota.example', 'Innovation Lead', 'd1', 'confirmado', now() - interval '0 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Verónica Álvarez', 'veronica.alvarez@grupoenergiabogota.example', 'Finance Director', 'd2', 'confirmado', now() - interval '0 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Sebastián Mejía', 'sebastian.mejia@grupoenergiabogota.example', 'Customer Success', 'both', 'confirmado', now() - interval '1 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Manuela Gómez', 'manuela.gomez@grupoenergiabogota.example', 'Head of Growth', 'both', 'confirmado', now() - interval '2 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Andrés Vélez', 'andres.velez@grupoenergiabogota.example', 'VP Engineering', 'd1', 'confirmado', now() - interval '4 days' - interval '19 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Sofía Hernández', 'sofia.hernandez@grupoenergiabogota.example', 'Platform Lead', 'd2', 'confirmado', now() - interval '7 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Samuel Arango', 'samuel.arango@grupoenergiabogota.example', 'UX Lead', 'both', 'confirmado', now() - interval '14 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Laura Ramírez', 'laura.ramirez@grupoenergiabogota.example', 'Data Lead', 'd1', 'confirmado', now() - interval '21 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Nicolás Quintero', 'nicolas.quintero@grupoenergiabogota.example', 'Open Innovation Lead', 'd2', 'confirmado', now() - interval '0 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Sara Cárdenas', 'sara.cardenas@grupoenergiabogota.example', 'Sales Director', 'both', 'confirmado', now() - interval '0 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Diego Restrepo', 'diego.restrepo@grupoenergiabogota.example', 'Operations', 'd1', 'confirmado', now() - interval '1 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Catalina Ortiz', 'catalina.ortiz@grupoenergiabogota.example', 'Partnerships', 'd2', 'confirmado', now() - interval '2 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Pablo Rodríguez', 'pablo.rodriguez@grupoenergiabogota.example', 'Digital Lead', 'both', 'confirmado', now() - interval '4 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Valentina Henao', 'valentina.henao@grupoenergiabogota.example', 'CMO', 'both', 'confirmado', now() - interval '7 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Tomás Sánchez', 'tomas.sanchez@grupoenergiabogota.example', 'CFO', 'd1', 'confirmado', now() - interval '14 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Adriana Castaño', 'adriana.castano@grupoenergiabogota.example', 'Strategy Lead', 'd2', 'confirmado', now() - interval '21 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Mateo Rivera', 'mateo.rivera@grupoenergiabogota.example', 'BD Manager', 'both', 'confirmado', now() - interval '0 days' - interval '19 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Luisa Correa', 'luisa.correa@grupoenergiabogota.example', 'Product Manager', 'd1', 'confirmado', now() - interval '0 days' - interval '19 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Carlos Hincapié', 'carlos.hincapie@grupoenergiabogota.example', 'Marketing Director', 'd2', 'confirmado', now() - interval '1 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Isabela Martínez', 'isabela.martinez@grupoenergiabogota.example', 'Brand Manager', 'both', 'confirmado', now() - interval '2 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Daniel Ospina', 'daniel.ospina@grupoenergiabogota.example', 'Innovation Lead', 'd1', 'confirmado', now() - interval '4 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Ana Pérez', 'ana.perez@grupoenergiabogota.example', 'Finance Director', 'd2', 'confirmado', now() - interval '7 days' - interval '16 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Alejandro Salazar', 'alejandro.salazar@grupoenergiabogota.example', 'Customer Success', 'both', 'confirmado', now() - interval '14 days' - interval '4 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Ximena Flores', 'ximena.flores@grupoenergiabogota.example', 'Head of Growth', 'both', 'confirmado', now() - interval '21 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Felipe Moreno', 'felipe.moreno@grupoenergiabogota.example', 'VP Engineering', 'd1', 'confirmado', now() - interval '0 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Paula Posada', 'paula.posada@grupoenergiabogota.example', 'Platform Lead', 'd2', 'confirmado', now() - interval '0 days' - interval '19 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Ricardo García', 'ricardo.garcia@grupoenergiabogota.example', 'UX Lead', 'both', 'confirmado', now() - interval '1 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Daniela Jaramillo', 'daniela.jaramillo@grupoenergiabogota.example', 'Data Lead', 'd1', 'confirmado', now() - interval '2 days' - interval '4 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'David López', 'david.lopez@grupoenergiabogota.example', 'Open Innovation Lead', 'd2', 'confirmado', now() - interval '4 days' - interval '18 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'María Echavarría', 'maria.echavarria@grupoenergiabogota.example', 'Sales Director', 'both', 'confirmado', now() - interval '7 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Santiago Torres', 'santiago.torres@grupoenergiabogota.example', 'Operations', 'd1', 'confirmado', now() - interval '14 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Natalia Álvarez', 'natalia.alvarez@grupoenergiabogota.example', 'Partnerships', 'd2', 'invitado', now() - interval '21 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Juan Mejía', 'juan.mejia@grupoenergiabogota.example', 'Digital Lead', 'both', 'invitado', now() - interval '0 days' - interval '17 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Mariana Gómez', 'mariana.gomez@grupoenergiabogota.example', 'CMO', 'both', 'invitado', now() - interval '0 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Gabriel Vélez', 'gabriel.velez@grupoenergiabogota.example', 'CFO', 'd1', 'invitado', now() - interval '1 days' - interval '0 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Camila Hernández', 'camila.hernandez@grupoenergiabogota.example', 'Strategy Lead', 'd2', 'invitado', now() - interval '2 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Esteban Arango', 'esteban.arango@grupoenergiabogota.example', 'BD Manager', 'both', 'invitado', now() - interval '4 days' - interval '1 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Verónica Ramírez', 'veronica.ramirez@grupoenergiabogota.example', 'Product Manager', 'd1', 'invitado', now() - interval '7 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Sebastián Quintero', 'sebastian.quintero@grupoenergiabogota.example', 'Marketing Director', 'd2', 'invitado', now() - interval '14 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Manuela Cárdenas', 'manuela.cardenas@grupoenergiabogota.example', 'Brand Manager', 'both', 'invitado', now() - interval '21 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Andrés Restrepo', 'andres.restrepo@grupoenergiabogota.example', 'Innovation Lead', 'd1', 'invitado', now() - interval '0 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Sofía Ortiz', 'sofia.ortiz@grupoenergiabogota.example', 'Finance Director', 'd2', 'invitado', now() - interval '0 days' - interval '18 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Samuel Rodríguez', 'samuel.rodriguez@grupoenergiabogota.example', 'Customer Success', 'both', 'invitado', now() - interval '1 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Laura Henao', 'laura.henao@grupoenergiabogota.example', 'Head of Growth', 'both', 'invitado', now() - interval '2 days' - interval '18 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Nicolás Sánchez', 'nicolas.sanchez@grupoenergiabogota.example', 'VP Engineering', 'd1', 'invitado', now() - interval '4 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Sara Castaño', 'sara.castano@grupoenergiabogota.example', 'Platform Lead', 'd2', 'sin_abrir', now() - interval '7 days' - interval '19 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Diego Rivera', 'diego.rivera@grupoenergiabogota.example', 'UX Lead', 'both', 'sin_abrir', now() - interval '14 days' - interval '19 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000102', 'Catalina Correa', 'catalina.correa@grupoenergiabogota.example', 'Data Lead', 'd1', 'sin_abrir', now() - interval '21 days' - interval '2 hours');
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000102', 'JuanGa', 'Comercial', 'startco', 'Andrés, las 3 piezas de la convocatoria Stars Up x StartCo están aprobadas. Excelente trabajo.', null, null, null, null, (date_trunc('day', now()) - interval '10 days' + time '11:00'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000102', 'Andrés Felipe Cárdenas', 'Grupo Energía Bogotá', 'sponsor', 'Equipo, ¿la pieza de redes para la convocatoria está alineada con la fecha de cierre de aplicaciones?', null, null, null, null, (date_trunc('day', now()) - interval '8 days' + time '16:21'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000102', 'JuanGa', 'Comercial', 'startco', 'Sí, todo cuadrado. El martes te paso el reporte de tracción.', null, null, null, null, (date_trunc('day', now()) - interval '8 days' + time '17:02'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000102', 'Andrés Felipe Cárdenas', 'Grupo Energía Bogotá', 'sponsor', 'Para los 4 apadrinamientos confirmamos: SPACE AG, Hooil, Volt y EcoSmart. ¿Necesitan algo adicional de nosotros?', null, null, null, null, (date_trunc('day', now()) - interval '5 days' + time '08:45'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000102', 'JuanGa', 'Comercial', 'startco', 'Confirmadas las 4 en el sistema. Solo falta cargar los logos de cada una para los stands. Te paso el formato hoy.', 'apadrinamiento', '4 apadrinamientos', null, null, (date_trunc('day', now()) - interval '5 days' + time '09:30'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000102', 1, 'Propuesta inicial enviada al cliente.', 'cambios', 'JuanGa', (date_trunc('day', now()) - interval '61 days' + time '09:00'), (date_trunc('day', now()) - interval '63 days' + time '09:00'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000102', 2, 'Ajuste: apadrinamientos extra solicitados por el cliente.', 'aprobada', 'JuanGa', (date_trunc('day', now()) - interval '68 days' + time '09:00'), (date_trunc('day', now()) - interval '70 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000102', 'legal', 'RUT_GEB.pdf', 200507, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000102', 'legal', 'Camara_comercio_GEB.pdf', 310151, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000102', 'legal', 'Cert_bancario_GEB.pdf', 291877, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000102', 'contrato', 'Contrato_GEB_firmado.pdf', 412000, true, current_date - 35);

-- Sura
insert into public.sponsors (id, event_id, name, initials, tier, stage, stage_changed_at, value_cop, sector, contact_name, contact_role, contact_email, contact_phone, legal_razon, legal_rut, legal_domicilio, legal_cc_status, hubspot_contacts, hubspot_segments, contract_type, contract_status, contract_signed_at, logo_path, nps, nps_quote, social_views) values ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Sura', 'SU', 'Partner', 'production', now() - interval '8 days', 250000000, 'Seguros', 'Juliana Posada', 'Directora Brand & Comms', 'juliana.posada@sura.example', '+57 315 888 4400', 'Suramericana S.A.', '811.012.271-9', 'Medellín', 'Vigente', 6, array['Marca','Patrocinios','Insurtech']::text[], 'Cliente', 'Firmado', current_date - 40, '00000000-0000-4000-8000-000000000103/logo/seed-logo', null, null, null)
  on conflict (id) do update set event_id = excluded.event_id, name = excluded.name, initials = excluded.initials, tier = excluded.tier, stage = excluded.stage, stage_changed_at = excluded.stage_changed_at, value_cop = excluded.value_cop, sector = excluded.sector, contact_name = excluded.contact_name, contact_role = excluded.contact_role, contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, legal_razon = excluded.legal_razon, legal_rut = excluded.legal_rut, legal_domicilio = excluded.legal_domicilio, legal_cc_status = excluded.legal_cc_status, hubspot_contacts = excluded.hubspot_contacts, hubspot_segments = excluded.hubspot_segments, contract_type = excluded.contract_type, contract_status = excluded.contract_status, contract_signed_at = excluded.contract_signed_at, logo_path = excluded.logo_path, nps = excluded.nps, nps_quote = excluded.nps_quote, social_views = excluded.social_views;
update public.sponsors set stage_changed_at = now() - interval '8 days' where id = '00000000-0000-4000-8000-000000000103';
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000103', 'Pieza redes: Día 1', 'produccion', null, null, (date_trunc('day', now()) - interval '7 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000103', 'Pieza redes: Día 2', 'produccion', null, null, (date_trunc('day', now()) - interval '7 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000103', 'Render stand 20 m²', 'produccion', null, null, (date_trunc('day', now()) - interval '7 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000103', 'Cápsula 1 min colaborativa', 'produccion', null, null, (date_trunc('day', now()) - interval '7 days' + time '09:00'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000103', 'JuanGa', 'Comercial', 'startco', '¡Bienvenidos al equipo StartCo! Esta semana arrancamos producción de las piezas. Te paso el brief el miércoles.', null, null, null, null, (date_trunc('day', now()) - interval '38 days' + time '09:00'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000103', 'Juliana Posada', 'Sura', 'sponsor', 'Perfecto, Juan. Atentos. Una nota: para la cápsula colaborativa nos gustaría tocar el ángulo de insurtech y microseguros. Hablamos.', null, null, null, null, (date_trunc('day', now()) - interval '37 days' + time '14:18'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000103', 'Carolina (Diseño)', 'Diseño', 'startco', 'Hola, Juliana: ya estamos en bocetos de las 4 piezas. La próxima semana subimos la primera ronda para tu revisión.', null, null, null, null, (date_trunc('day', now()) - interval '6 days' + time '10:30'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000103', 1, 'Propuesta inicial enviada al cliente.', 'cambios', 'JuanGa', (date_trunc('day', now()) - interval '61 days' + time '09:00'), (date_trunc('day', now()) - interval '63 days' + time '09:00'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000103', 2, 'Ajuste: apadrinamientos extra solicitados por el cliente.', 'aprobada', 'JuanGa', (date_trunc('day', now()) - interval '68 days' + time '09:00'), (date_trunc('day', now()) - interval '70 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000103', 'legal', 'RUT_SU.pdf', 191370, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000103', 'legal', 'Camara_comercio_SU.pdf', 301014, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000103', 'legal', 'Cert_bancario_SU.pdf', 282740, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000103', 'contrato', 'Contrato_SU_firmado.pdf', 412000, true, current_date - 40);

-- Celsia
insert into public.sponsors (id, event_id, name, initials, tier, stage, stage_changed_at, value_cop, sector, contact_name, contact_role, contact_email, contact_phone, legal_razon, legal_rut, legal_domicilio, legal_cc_status, hubspot_contacts, hubspot_segments, contract_type, contract_status, contract_signed_at, logo_path, nps, nps_quote, social_views) values ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'Celsia', 'CL', 'Serie B', 'contract', now() - interval '2 days', 90000000, 'Energía', 'Laura Hincapié', 'Líder Open Innovation', 'laura.hincapie@celsia.example', '+57 304 998 1100', 'Celsia S.A. E.S.P.', '811.000.231-1', 'Medellín', 'Vigente', 4, array['Energytech','Spinoffs']::text[], 'StartCo', 'En revisión legal', null, null, null, null, null)
  on conflict (id) do update set event_id = excluded.event_id, name = excluded.name, initials = excluded.initials, tier = excluded.tier, stage = excluded.stage, stage_changed_at = excluded.stage_changed_at, value_cop = excluded.value_cop, sector = excluded.sector, contact_name = excluded.contact_name, contact_role = excluded.contact_role, contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, legal_razon = excluded.legal_razon, legal_rut = excluded.legal_rut, legal_domicilio = excluded.legal_domicilio, legal_cc_status = excluded.legal_cc_status, hubspot_contacts = excluded.hubspot_contacts, hubspot_segments = excluded.hubspot_segments, contract_type = excluded.contract_type, contract_status = excluded.contract_status, contract_signed_at = excluded.contract_signed_at, logo_path = excluded.logo_path, nps = excluded.nps, nps_quote = excluded.nps_quote, social_views = excluded.social_views;
update public.sponsors set stage_changed_at = now() - interval '2 days' where id = '00000000-0000-4000-8000-000000000104';
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000104', 'Enerbit', 'Energía');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000104', 'Solenium', 'Solar');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000104', 'WattCo', 'Smart Grid');
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000104', 'JuanGa', 'Comercial', 'startco', 'Laura, te paso el contrato en su versión final. Cuando puedan, revísenlo con legal y nos confirman.', 'contrato', 'Contrato Serie B v2', 'contrato_celsia_v2.pdf', 430080, (date_trunc('day', now()) - interval '6 days' + time '15:40'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000104', 'Laura Hincapié', 'Celsia', 'sponsor', 'Recibido. Legal lo está revisando. Probablemente nos pidan ajustar la cláusula de exclusividad sectorial. Te confirmo esta semana.', null, null, null, null, (date_trunc('day', now()) - interval '3 days' + time '10:12'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000104', 'JuanGa', 'Comercial', 'startco', 'Sin problema. Quedo atento.', null, null, null, null, (date_trunc('day', now()) - interval '2 days' + time '09:00'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000104', 1, 'Propuesta inicial enviada al cliente.', 'cambios', 'JuanGa', (date_trunc('day', now()) - interval '61 days' + time '09:00'), (date_trunc('day', now()) - interval '63 days' + time '09:00'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000104', 2, 'Ajuste: apadrinamientos extra solicitados por el cliente.', 'aprobada', 'JuanGa', (date_trunc('day', now()) - interval '68 days' + time '09:00'), (date_trunc('day', now()) - interval '70 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000104', 'legal', 'RUT_CL.pdf', 191370, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000104', 'legal', 'Camara_comercio_CL.pdf', 301014, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000104', 'legal', 'Cert_bancario_CL.pdf', 282740, false, (date_trunc('day', now()) - interval '60 days' + time '09:00'));

-- Bavaria
insert into public.sponsors (id, event_id, name, initials, tier, stage, stage_changed_at, value_cop, sector, contact_name, contact_role, contact_email, contact_phone, legal_razon, legal_rut, legal_domicilio, legal_cc_status, hubspot_contacts, hubspot_segments, contract_type, contract_status, contract_signed_at, logo_path, nps, nps_quote, social_views) values ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'Bavaria', 'BV', 'Serie A', 'kickoff', now() - interval '1 days', 62000000, 'Consumo Masivo', 'Sebastián Ortiz', 'Brand Manager', 'sebastian.ortiz@bavaria.example', '+57 320 444 5566', 'Bavaria S.A.', '860.005.224-6', 'Bogotá', 'Por validar', 3, array['Marca','Eventos']::text[], 'Pendiente', 'No iniciado', null, null, null, null, null)
  on conflict (id) do update set event_id = excluded.event_id, name = excluded.name, initials = excluded.initials, tier = excluded.tier, stage = excluded.stage, stage_changed_at = excluded.stage_changed_at, value_cop = excluded.value_cop, sector = excluded.sector, contact_name = excluded.contact_name, contact_role = excluded.contact_role, contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, legal_razon = excluded.legal_razon, legal_rut = excluded.legal_rut, legal_domicilio = excluded.legal_domicilio, legal_cc_status = excluded.legal_cc_status, hubspot_contacts = excluded.hubspot_contacts, hubspot_segments = excluded.hubspot_segments, contract_type = excluded.contract_type, contract_status = excluded.contract_status, contract_signed_at = excluded.contract_signed_at, logo_path = excluded.logo_path, nps = excluded.nps, nps_quote = excluded.nps_quote, social_views = excluded.social_views;
update public.sponsors set stage_changed_at = now() - interval '1 days' where id = '00000000-0000-4000-8000-000000000105';
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000105', 'Pibox', 'Logística');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000105', 'Bemtevi', 'B2B Sales');
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000105', 'JuanGa', 'Comercial', 'startco', 'Hola, Sebastián: gracias por confirmar StartCo 2026. En el portal puedes cargar el RUT y la Cámara de Comercio para arrancar, y revisar la propuesta.', null, null, null, null, (date_trunc('day', now()) - interval '1 days' + time '11:20'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000105', 'Sebastián Ortiz', 'Bavaria', 'sponsor', 'Listo, Juan, hoy mismo te paso todo. Los apadrinamientos los manejamos con mi equipo; te aviso para una llamada.', null, null, null, null, (date_trunc('day', now()) - interval '1 days' + time '12:05'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000105', 1, 'Propuesta inicial enviada al cliente.', 'enviada', 'JuanGa', null, (date_trunc('day', now()) - interval '1 days' + time '09:00'));

-- EPM
insert into public.sponsors (id, event_id, name, initials, tier, stage, stage_changed_at, value_cop, sector, contact_name, contact_role, contact_email, contact_phone, legal_razon, legal_rut, legal_domicilio, legal_cc_status, hubspot_contacts, hubspot_segments, contract_type, contract_status, contract_signed_at, logo_path, nps, nps_quote, social_views) values ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'EPM', 'EM', 'Serie B', 'ready', now() - interval '3 days', 90000000, 'Servicios Públicos', 'Mateo Gómez', 'Líder de Innovación Abierta', 'mateo.gomez@epm.example', '+57 310 555 9911', 'Empresas Públicas de Medellín E.S.P.', '890.904.996-1', 'Medellín', 'Vigente', 4, array['Energytech','Innovación']::text[], 'Cliente', 'Firmado', current_date - 45, '00000000-0000-4000-8000-000000000106/logo/seed-logo', null, null, null)
  on conflict (id) do update set event_id = excluded.event_id, name = excluded.name, initials = excluded.initials, tier = excluded.tier, stage = excluded.stage, stage_changed_at = excluded.stage_changed_at, value_cop = excluded.value_cop, sector = excluded.sector, contact_name = excluded.contact_name, contact_role = excluded.contact_role, contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, legal_razon = excluded.legal_razon, legal_rut = excluded.legal_rut, legal_domicilio = excluded.legal_domicilio, legal_cc_status = excluded.legal_cc_status, hubspot_contacts = excluded.hubspot_contacts, hubspot_segments = excluded.hubspot_segments, contract_type = excluded.contract_type, contract_status = excluded.contract_status, contract_signed_at = excluded.contract_signed_at, logo_path = excluded.logo_path, nps = excluded.nps, nps_quote = excluded.nps_quote, social_views = excluded.social_views;
update public.sponsors set stage_changed_at = now() - interval '3 days' where id = '00000000-0000-4000-8000-000000000106';
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000106', 'Pieza redes: Día 1', 'aprobado', (date_trunc('day', now()) - interval '10 days' + time '10:00'), (date_trunc('day', now()) - interval '9 days' + time '15:00'), (date_trunc('day', now()) - interval '11 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000106', 'Render stand 12 m²', 'aprobado', (date_trunc('day', now()) - interval '9 days' + time '10:00'), (date_trunc('day', now()) - interval '8 days' + time '15:00'), (date_trunc('day', now()) - interval '10 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000106', 'Pieza Newsletter', 'aprobado', (date_trunc('day', now()) - interval '8 days' + time '10:00'), (date_trunc('day', now()) - interval '7 days' + time '15:00'), (date_trunc('day', now()) - interval '9 days' + time '09:00'));
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000106', 'EnerVerse', 'Smart Grid');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000106', 'AquaBot', 'AguaTech');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000106', 'GridSense', 'IoT Energía');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Alejandro Salazar', 'alejandro.salazar@epm.example', 'Operations', 'd1', 'confirmado', now() - interval '14 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Ximena Flores', 'ximena.flores@epm.example', 'Partnerships', 'd2', 'confirmado', now() - interval '21 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Felipe Moreno', 'felipe.moreno@epm.example', 'Digital Lead', 'both', 'confirmado', now() - interval '0 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Paula Posada', 'paula.posada@epm.example', 'CMO', 'd1', 'confirmado', now() - interval '0 days' - interval '4 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Ricardo García', 'ricardo.garcia@epm.example', 'CFO', 'd2', 'confirmado', now() - interval '1 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Daniela Jaramillo', 'daniela.jaramillo@epm.example', 'Strategy Lead', 'both', 'confirmado', now() - interval '2 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'David López', 'david.lopez@epm.example', 'BD Manager', 'd1', 'confirmado', now() - interval '4 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'María Echavarría', 'maria.echavarria@epm.example', 'Product Manager', 'd2', 'confirmado', now() - interval '7 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Santiago Torres', 'santiago.torres@epm.example', 'Marketing Director', 'both', 'confirmado', now() - interval '14 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Natalia Álvarez', 'natalia.alvarez@epm.example', 'Brand Manager', 'both', 'confirmado', now() - interval '21 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Juan Mejía', 'juan.mejia@epm.example', 'Innovation Lead', 'd1', 'invitado', now() - interval '0 days' - interval '2 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000106', 'Mariana Gómez', 'mariana.gomez@epm.example', 'Finance Director', 'd2', 'invitado', now() - interval '0 days' - interval '5 hours');
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000106', 'Mateo Gómez', 'EPM', 'sponsor', 'Equipo, ya tenemos todo aprobado de nuestro lado. Avisen cuándo cargan inscritos para empezar a movilizar al equipo.', null, null, null, null, (date_trunc('day', now()) - interval '4 days' + time '17:00'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000106', 'JuanGa', 'Comercial', 'startco', 'Mateo, ya puedes cargar inscritos desde tu portal. Te avisamos en cuanto el contador supere 50.', null, null, null, null, (date_trunc('day', now()) - interval '3 days' + time '08:40'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000106', 1, 'Propuesta inicial enviada al cliente.', 'aprobada', 'JuanGa', (date_trunc('day', now()) - interval '68 days' + time '09:00'), (date_trunc('day', now()) - interval '70 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000106', 'legal', 'RUT_EM.pdf', 191370, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000106', 'legal', 'Camara_comercio_EM.pdf', 301014, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000106', 'legal', 'Cert_bancario_EM.pdf', 282740, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000106', 'contrato', 'Contrato_EM_firmado.pdf', 412000, true, current_date - 45);
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000106', 'apadrinamientos-de-startups', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000106', 'imagen-en-pagina-web-del-evento', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000106', 'marketing-digital-en-redes-sociales', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000106', 'mencion-en-boletin-de-prensa-30-medios', true, now() - interval '1 day');

-- Rappi
insert into public.sponsors (id, event_id, name, initials, tier, stage, stage_changed_at, value_cop, sector, contact_name, contact_role, contact_email, contact_phone, legal_razon, legal_rut, legal_domicilio, legal_cc_status, hubspot_contacts, hubspot_segments, contract_type, contract_status, contract_signed_at, logo_path, nps, nps_quote, social_views) values ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'Rappi', 'RP', 'Unicorn', 'post', now() - interval '0 days', 166000000, 'Tech / Delivery', 'Andrea Salcedo', 'Head of B2B Marketing', 'andrea.salcedo@rappi.example', '+57 311 999 4422', 'Rappi S.A.S.', '901.220.000-1', 'Bogotá', 'Vigente', 8, array['Marca','Tech','Patrocinios']::text[], 'Cliente', 'Firmado', current_date - 60, '00000000-0000-4000-8000-000000000107/logo/seed-logo', 9.4, 'Volveríamos sin pensarlo. Las apadrinadas fueron oro y la pieza en redes superó nuestras métricas del trimestre.', 480000)
  on conflict (id) do update set event_id = excluded.event_id, name = excluded.name, initials = excluded.initials, tier = excluded.tier, stage = excluded.stage, stage_changed_at = excluded.stage_changed_at, value_cop = excluded.value_cop, sector = excluded.sector, contact_name = excluded.contact_name, contact_role = excluded.contact_role, contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, legal_razon = excluded.legal_razon, legal_rut = excluded.legal_rut, legal_domicilio = excluded.legal_domicilio, legal_cc_status = excluded.legal_cc_status, hubspot_contacts = excluded.hubspot_contacts, hubspot_segments = excluded.hubspot_segments, contract_type = excluded.contract_type, contract_status = excluded.contract_status, contract_signed_at = excluded.contract_signed_at, logo_path = excluded.logo_path, nps = excluded.nps, nps_quote = excluded.nps_quote, social_views = excluded.social_views;
update public.sponsors set stage_changed_at = now() - interval '0 days' where id = '00000000-0000-4000-8000-000000000107';
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000107', 'Pieza redes: Día 1', 'aprobado', (date_trunc('day', now()) - interval '21 days' + time '10:00'), (date_trunc('day', now()) - interval '20 days' + time '15:00'), (date_trunc('day', now()) - interval '22 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000107', 'Pieza redes: Día 2', 'aprobado', (date_trunc('day', now()) - interval '21 days' + time '10:00'), (date_trunc('day', now()) - interval '20 days' + time '15:00'), (date_trunc('day', now()) - interval '22 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000107', 'Render stand 16 m²', 'aprobado', (date_trunc('day', now()) - interval '19 days' + time '10:00'), (date_trunc('day', now()) - interval '18 days' + time '15:00'), (date_trunc('day', now()) - interval '20 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000107', 'Newsletter #1', 'aprobado', (date_trunc('day', now()) - interval '17 days' + time '10:00'), (date_trunc('day', now()) - interval '16 days' + time '15:00'), (date_trunc('day', now()) - interval '18 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000107', 'Newsletter #2', 'aprobado', (date_trunc('day', now()) - interval '16 days' + time '10:00'), (date_trunc('day', now()) - interval '15 days' + time '15:00'), (date_trunc('day', now()) - interval '17 days' + time '09:00'));
insert into public.assets (sponsor_id, name, status, sent_at, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000107', 'Imagen escarapela', 'aprobado', (date_trunc('day', now()) - interval '15 days' + time '10:00'), (date_trunc('day', now()) - interval '14 days' + time '15:00'), (date_trunc('day', now()) - interval '16 days' + time '09:00'));
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000107', 'Robinfood', 'CloudKitchen');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000107', 'Chiper', 'B2B Retail');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000107', 'Treble', 'WhatsApp');
insert into public.sponsored_startups (sponsor_id, name, sector) values ('00000000-0000-4000-8000-000000000107', 'Foodology', 'CloudKitchen');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Luisa Hernández', 'luisa.hernandez@rappi.example', 'Platform Lead', 'd2', 'confirmado', now() - interval '21 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Carlos Arango', 'carlos.arango@rappi.example', 'UX Lead', 'both', 'confirmado', now() - interval '0 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Isabela Ramírez', 'isabela.ramirez@rappi.example', 'Data Lead', 'd1', 'confirmado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Daniel Quintero', 'daniel.quintero@rappi.example', 'Open Innovation Lead', 'd2', 'confirmado', now() - interval '1 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ana Cárdenas', 'ana.cardenas@rappi.example', 'Sales Director', 'both', 'confirmado', now() - interval '2 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Alejandro Restrepo', 'alejandro.restrepo@rappi.example', 'Operations', 'd1', 'confirmado', now() - interval '4 days' - interval '12 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ximena Ortiz', 'ximena.ortiz@rappi.example', 'Partnerships', 'd2', 'confirmado', now() - interval '7 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Felipe Rodríguez', 'felipe.rodriguez@rappi.example', 'Digital Lead', 'both', 'confirmado', now() - interval '14 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Paula Henao', 'paula.henao@rappi.example', 'CMO', 'both', 'confirmado', now() - interval '21 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ricardo Sánchez', 'ricardo.sanchez@rappi.example', 'CFO', 'd1', 'confirmado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Daniela Castaño', 'daniela.castano@rappi.example', 'Strategy Lead', 'd2', 'confirmado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'David Rivera', 'david.rivera@rappi.example', 'BD Manager', 'both', 'confirmado', now() - interval '1 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'María Correa', 'maria.correa@rappi.example', 'Product Manager', 'd1', 'confirmado', now() - interval '2 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Santiago Hincapié', 'santiago.hincapie@rappi.example', 'Marketing Director', 'd2', 'confirmado', now() - interval '4 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Natalia Martínez', 'natalia.martinez@rappi.example', 'Brand Manager', 'both', 'confirmado', now() - interval '7 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Juan Ospina', 'juan.ospina@rappi.example', 'Innovation Lead', 'd1', 'confirmado', now() - interval '14 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Mariana Pérez', 'mariana.perez@rappi.example', 'Finance Director', 'd2', 'confirmado', now() - interval '21 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Gabriel Salazar', 'gabriel.salazar@rappi.example', 'Customer Success', 'both', 'confirmado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Camila Flores', 'camila.flores@rappi.example', 'Head of Growth', 'both', 'confirmado', now() - interval '0 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Esteban Moreno', 'esteban.moreno@rappi.example', 'VP Engineering', 'd1', 'confirmado', now() - interval '1 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Verónica Posada', 'veronica.posada@rappi.example', 'Platform Lead', 'd2', 'confirmado', now() - interval '2 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sebastián García', 'sebastian.garcia@rappi.example', 'UX Lead', 'both', 'confirmado', now() - interval '4 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Manuela Jaramillo', 'manuela.jaramillo@rappi.example', 'Data Lead', 'd1', 'confirmado', now() - interval '7 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Andrés López', 'andres.lopez@rappi.example', 'Open Innovation Lead', 'd2', 'confirmado', now() - interval '14 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sofía Echavarría', 'sofia.echavarria@rappi.example', 'Sales Director', 'both', 'confirmado', now() - interval '21 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Samuel Torres', 'samuel.torres@rappi.example', 'Operations', 'd1', 'confirmado', now() - interval '0 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Laura Álvarez', 'laura.alvarez@rappi.example', 'Partnerships', 'd2', 'confirmado', now() - interval '0 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Nicolás Mejía', 'nicolas.mejia@rappi.example', 'Digital Lead', 'both', 'confirmado', now() - interval '1 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sara Gómez', 'sara.gomez@rappi.example', 'CMO', 'both', 'confirmado', now() - interval '2 days' - interval '4 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Diego Vélez', 'diego.velez@rappi.example', 'CFO', 'd1', 'confirmado', now() - interval '4 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Catalina Hernández', 'catalina.hernandez@rappi.example', 'Strategy Lead', 'd2', 'confirmado', now() - interval '7 days' - interval '12 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Pablo Arango', 'pablo.arango@rappi.example', 'BD Manager', 'both', 'confirmado', now() - interval '14 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Valentina Ramírez', 'valentina.ramirez@rappi.example', 'Product Manager', 'd1', 'confirmado', now() - interval '21 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Tomás Quintero', 'tomas.quintero@rappi.example', 'Marketing Director', 'd2', 'confirmado', now() - interval '0 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Adriana Cárdenas', 'adriana.cardenas@rappi.example', 'Brand Manager', 'both', 'confirmado', now() - interval '0 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Mateo Restrepo', 'mateo.restrepo@rappi.example', 'Innovation Lead', 'd1', 'confirmado', now() - interval '1 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Luisa Ortiz', 'luisa.ortiz@rappi.example', 'Finance Director', 'd2', 'confirmado', now() - interval '2 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Carlos Rodríguez', 'carlos.rodriguez@rappi.example', 'Customer Success', 'both', 'confirmado', now() - interval '4 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Isabela Henao', 'isabela.henao@rappi.example', 'Head of Growth', 'both', 'confirmado', now() - interval '7 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Daniel Sánchez', 'daniel.sanchez@rappi.example', 'VP Engineering', 'd1', 'confirmado', now() - interval '14 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ana Castaño', 'ana.castano@rappi.example', 'Platform Lead', 'd2', 'confirmado', now() - interval '21 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Alejandro Rivera', 'alejandro.rivera@rappi.example', 'UX Lead', 'both', 'confirmado', now() - interval '0 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ximena Correa', 'ximena.correa@rappi.example', 'Data Lead', 'd1', 'confirmado', now() - interval '0 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Felipe Hincapié', 'felipe.hincapie@rappi.example', 'Open Innovation Lead', 'd2', 'confirmado', now() - interval '1 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Paula Martínez', 'paula.martinez@rappi.example', 'Sales Director', 'both', 'confirmado', now() - interval '2 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ricardo Ospina', 'ricardo.ospina@rappi.example', 'Operations', 'd1', 'confirmado', now() - interval '4 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Daniela Pérez', 'daniela.perez@rappi.example', 'Partnerships', 'd2', 'confirmado', now() - interval '7 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'David Salazar', 'david.salazar@rappi.example', 'Digital Lead', 'both', 'confirmado', now() - interval '14 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'María Flores', 'maria.flores@rappi.example', 'CMO', 'both', 'confirmado', now() - interval '21 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Santiago Moreno', 'santiago.moreno@rappi.example', 'CFO', 'd1', 'confirmado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Natalia Posada', 'natalia.posada@rappi.example', 'Strategy Lead', 'd2', 'confirmado', now() - interval '0 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Juan García', 'juan.garcia@rappi.example', 'BD Manager', 'both', 'confirmado', now() - interval '1 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Mariana Jaramillo', 'mariana.jaramillo@rappi.example', 'Product Manager', 'd1', 'confirmado', now() - interval '2 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Gabriel López', 'gabriel.lopez@rappi.example', 'Marketing Director', 'd2', 'confirmado', now() - interval '4 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Camila Echavarría', 'camila.echavarria@rappi.example', 'Brand Manager', 'both', 'confirmado', now() - interval '7 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Esteban Torres', 'esteban.torres@rappi.example', 'Innovation Lead', 'd1', 'confirmado', now() - interval '14 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Verónica Álvarez', 'veronica.alvarez@rappi.example', 'Finance Director', 'd2', 'confirmado', now() - interval '21 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sebastián Mejía', 'sebastian.mejia@rappi.example', 'Customer Success', 'both', 'confirmado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Manuela Gómez', 'manuela.gomez@rappi.example', 'Head of Growth', 'both', 'confirmado', now() - interval '0 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Andrés Vélez', 'andres.velez@rappi.example', 'VP Engineering', 'd1', 'confirmado', now() - interval '1 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sofía Hernández', 'sofia.hernandez@rappi.example', 'Platform Lead', 'd2', 'confirmado', now() - interval '2 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Samuel Arango', 'samuel.arango@rappi.example', 'UX Lead', 'both', 'confirmado', now() - interval '4 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Laura Ramírez', 'laura.ramirez@rappi.example', 'Data Lead', 'd1', 'confirmado', now() - interval '7 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Nicolás Quintero', 'nicolas.quintero@rappi.example', 'Open Innovation Lead', 'd2', 'confirmado', now() - interval '14 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sara Cárdenas', 'sara.cardenas@rappi.example', 'Sales Director', 'both', 'confirmado', now() - interval '21 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Diego Restrepo', 'diego.restrepo@rappi.example', 'Operations', 'd1', 'confirmado', now() - interval '0 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Catalina Ortiz', 'catalina.ortiz@rappi.example', 'Partnerships', 'd2', 'confirmado', now() - interval '0 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Pablo Rodríguez', 'pablo.rodriguez@rappi.example', 'Digital Lead', 'both', 'confirmado', now() - interval '1 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Valentina Henao', 'valentina.henao@rappi.example', 'CMO', 'both', 'confirmado', now() - interval '2 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Tomás Sánchez', 'tomas.sanchez@rappi.example', 'CFO', 'd1', 'confirmado', now() - interval '4 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Adriana Castaño', 'adriana.castano@rappi.example', 'Strategy Lead', 'd2', 'confirmado', now() - interval '7 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Mateo Rivera', 'mateo.rivera@rappi.example', 'BD Manager', 'both', 'confirmado', now() - interval '14 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Luisa Correa', 'luisa.correa@rappi.example', 'Product Manager', 'd1', 'confirmado', now() - interval '21 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Carlos Hincapié', 'carlos.hincapie@rappi.example', 'Marketing Director', 'd2', 'confirmado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Isabela Martínez', 'isabela.martinez@rappi.example', 'Brand Manager', 'both', 'confirmado', now() - interval '0 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Daniel Ospina', 'daniel.ospina@rappi.example', 'Innovation Lead', 'd1', 'confirmado', now() - interval '1 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ana Pérez', 'ana.perez@rappi.example', 'Finance Director', 'd2', 'confirmado', now() - interval '2 days' - interval '3 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Alejandro Salazar', 'alejandro.salazar@rappi.example', 'Customer Success', 'both', 'confirmado', now() - interval '4 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ximena Flores', 'ximena.flores@rappi.example', 'Head of Growth', 'both', 'confirmado', now() - interval '7 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Felipe Moreno', 'felipe.moreno@rappi.example', 'VP Engineering', 'd1', 'confirmado', now() - interval '14 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Paula Posada', 'paula.posada@rappi.example', 'Platform Lead', 'd2', 'confirmado', now() - interval '21 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ricardo García', 'ricardo.garcia@rappi.example', 'UX Lead', 'both', 'confirmado', now() - interval '0 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Daniela Jaramillo', 'daniela.jaramillo@rappi.example', 'Data Lead', 'd1', 'confirmado', now() - interval '0 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'David López', 'david.lopez@rappi.example', 'Open Innovation Lead', 'd2', 'confirmado', now() - interval '1 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'María Echavarría', 'maria.echavarria@rappi.example', 'Sales Director', 'both', 'confirmado', now() - interval '2 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Santiago Torres', 'santiago.torres@rappi.example', 'Operations', 'd1', 'confirmado', now() - interval '4 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Natalia Álvarez', 'natalia.alvarez@rappi.example', 'Partnerships', 'd2', 'confirmado', now() - interval '7 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Juan Mejía', 'juan.mejia@rappi.example', 'Digital Lead', 'both', 'confirmado', now() - interval '14 days' - interval '4 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Mariana Gómez', 'mariana.gomez@rappi.example', 'CMO', 'both', 'confirmado', now() - interval '21 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Gabriel Vélez', 'gabriel.velez@rappi.example', 'CFO', 'd1', 'confirmado', now() - interval '0 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Camila Hernández', 'camila.hernandez@rappi.example', 'Strategy Lead', 'd2', 'confirmado', now() - interval '0 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Esteban Arango', 'esteban.arango@rappi.example', 'BD Manager', 'both', 'confirmado', now() - interval '1 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Verónica Ramírez', 'veronica.ramirez@rappi.example', 'Product Manager', 'd1', 'confirmado', now() - interval '2 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sebastián Quintero', 'sebastian.quintero@rappi.example', 'Marketing Director', 'd2', 'confirmado', now() - interval '4 days' - interval '12 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Manuela Cárdenas', 'manuela.cardenas@rappi.example', 'Brand Manager', 'both', 'confirmado', now() - interval '7 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Andrés Restrepo', 'andres.restrepo@rappi.example', 'Innovation Lead', 'd1', 'confirmado', now() - interval '14 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sofía Ortiz', 'sofia.ortiz@rappi.example', 'Finance Director', 'd2', 'confirmado', now() - interval '21 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Samuel Rodríguez', 'samuel.rodriguez@rappi.example', 'Customer Success', 'both', 'confirmado', now() - interval '0 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Laura Henao', 'laura.henao@rappi.example', 'Head of Growth', 'both', 'confirmado', now() - interval '0 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Nicolás Sánchez', 'nicolas.sanchez@rappi.example', 'VP Engineering', 'd1', 'confirmado', now() - interval '1 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sara Castaño', 'sara.castano@rappi.example', 'Platform Lead', 'd2', 'confirmado', now() - interval '2 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Diego Rivera', 'diego.rivera@rappi.example', 'UX Lead', 'both', 'confirmado', now() - interval '4 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Catalina Correa', 'catalina.correa@rappi.example', 'Data Lead', 'd1', 'confirmado', now() - interval '7 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Pablo Hincapié', 'pablo.hincapie@rappi.example', 'Open Innovation Lead', 'd2', 'confirmado', now() - interval '14 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Valentina Martínez', 'valentina.martinez@rappi.example', 'Sales Director', 'both', 'confirmado', now() - interval '21 days' - interval '12 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Tomás Ospina', 'tomas.ospina@rappi.example', 'Operations', 'd1', 'confirmado', now() - interval '0 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Adriana Pérez', 'adriana.perez@rappi.example', 'Partnerships', 'd2', 'confirmado', now() - interval '0 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Mateo Salazar', 'mateo.salazar@rappi.example', 'Digital Lead', 'both', 'confirmado', now() - interval '1 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Luisa Flores', 'luisa.flores@rappi.example', 'CMO', 'both', 'confirmado', now() - interval '2 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Carlos Moreno', 'carlos.moreno@rappi.example', 'CFO', 'd1', 'confirmado', now() - interval '4 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Isabela Posada', 'isabela.posada@rappi.example', 'Strategy Lead', 'd2', 'confirmado', now() - interval '7 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Daniel García', 'daniel.garcia@rappi.example', 'BD Manager', 'both', 'confirmado', now() - interval '14 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ana Jaramillo', 'ana.jaramillo@rappi.example', 'Product Manager', 'd1', 'confirmado', now() - interval '21 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Alejandro López', 'alejandro.lopez@rappi.example', 'Marketing Director', 'd2', 'confirmado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ximena Echavarría', 'ximena.echavarria@rappi.example', 'Brand Manager', 'both', 'invitado', now() - interval '0 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Felipe Torres', 'felipe.torres@rappi.example', 'Innovation Lead', 'd1', 'invitado', now() - interval '1 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Paula Álvarez', 'paula.alvarez@rappi.example', 'Finance Director', 'd2', 'invitado', now() - interval '2 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Ricardo Mejía', 'ricardo.mejia@rappi.example', 'Customer Success', 'both', 'invitado', now() - interval '4 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Daniela Gómez', 'daniela.gomez@rappi.example', 'Head of Growth', 'both', 'invitado', now() - interval '7 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'David Vélez', 'david.velez@rappi.example', 'VP Engineering', 'd1', 'invitado', now() - interval '14 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'María Hernández', 'maria.hernandez@rappi.example', 'Platform Lead', 'd2', 'invitado', now() - interval '21 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Santiago Arango', 'santiago.arango@rappi.example', 'UX Lead', 'both', 'invitado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Natalia Ramírez', 'natalia.ramirez@rappi.example', 'Data Lead', 'd1', 'invitado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Juan Quintero', 'juan.quintero@rappi.example', 'Open Innovation Lead', 'd2', 'invitado', now() - interval '1 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Mariana Cárdenas', 'mariana.cardenas@rappi.example', 'Sales Director', 'both', 'invitado', now() - interval '2 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Gabriel Restrepo', 'gabriel.restrepo@rappi.example', 'Operations', 'd1', 'invitado', now() - interval '4 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Camila Ortiz', 'camila.ortiz@rappi.example', 'Partnerships', 'd2', 'invitado', now() - interval '7 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Esteban Rodríguez', 'esteban.rodriguez@rappi.example', 'Digital Lead', 'both', 'invitado', now() - interval '14 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Verónica Henao', 'veronica.henao@rappi.example', 'CMO', 'both', 'invitado', now() - interval '21 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sebastián Sánchez', 'sebastian.sanchez@rappi.example', 'CFO', 'd1', 'invitado', now() - interval '0 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Manuela Castaño', 'manuela.castano@rappi.example', 'Strategy Lead', 'd2', 'invitado', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Andrés Rivera', 'andres.rivera@rappi.example', 'BD Manager', 'both', 'invitado', now() - interval '1 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sofía Correa', 'sofia.correa@rappi.example', 'Product Manager', 'd1', 'invitado', now() - interval '2 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Samuel Hincapié', 'samuel.hincapie@rappi.example', 'Marketing Director', 'd2', 'invitado', now() - interval '4 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Laura Martínez', 'laura.martinez@rappi.example', 'Brand Manager', 'both', 'invitado', now() - interval '7 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Nicolás Ospina', 'nicolas.ospina@rappi.example', 'Innovation Lead', 'd1', 'invitado', now() - interval '14 days' - interval '8 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Sara Pérez', 'sara.perez@rappi.example', 'Finance Director', 'd2', 'invitado', now() - interval '21 days' - interval '4 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Diego Salazar', 'diego.salazar@rappi.example', 'Customer Success', 'both', 'invitado', now() - interval '0 days' - interval '7 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Catalina Flores', 'catalina.flores@rappi.example', 'Head of Growth', 'both', 'sin_abrir', now() - interval '0 days' - interval '9 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Pablo Moreno', 'pablo.moreno@rappi.example', 'VP Engineering', 'd1', 'sin_abrir', now() - interval '1 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Valentina Posada', 'valentina.posada@rappi.example', 'Platform Lead', 'd2', 'sin_abrir', now() - interval '2 days' - interval '10 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Tomás García', 'tomas.garcia@rappi.example', 'UX Lead', 'both', 'sin_abrir', now() - interval '4 days' - interval '6 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Adriana Jaramillo', 'adriana.jaramillo@rappi.example', 'Data Lead', 'd1', 'sin_abrir', now() - interval '7 days' - interval '11 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Mateo López', 'mateo.lopez@rappi.example', 'Open Innovation Lead', 'd2', 'sin_abrir', now() - interval '14 days' - interval '5 hours');
insert into public.attendees (sponsor_id, name, email, role, day, status, created_at) values ('00000000-0000-4000-8000-000000000107', 'Luisa Echavarría', 'luisa.echavarria@rappi.example', 'Sales Director', 'both', 'sin_abrir', now() - interval '21 days' - interval '10 hours');
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000107', 'JuanGa', 'Comercial', 'startco', '¡Andrea, qué evento! Subimos las evidencias de los dos días. Aviso cuando completemos las métricas finales.', null, null, null, null, (date_trunc('day', now()) - interval '3 days' + time '08:00'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000107', 'Andrea Salcedo', 'Rappi', 'sponsor', 'Volveríamos sin pensarlo. Las apadrinadas fueron oro y la pieza en redes superó nuestras métricas del trimestre. Encuesta llenada.', null, null, null, null, (date_trunc('day', now()) - interval '3 days' + time '19:30'));
insert into public.comments (sponsor_id, author_name, author_role, team, body, context_kind, context_label, attachment_name, attachment_size, created_at) values ('00000000-0000-4000-8000-000000000107', 'JuanGa', 'Comercial', 'startco', 'NPS 9,4: el más alto del evento. Compartimos casos de éxito en LinkedIn esta semana.', null, null, null, null, (date_trunc('day', now()) - interval '1 days' + time '10:15'));
insert into public.proposals (sponsor_id, version, note, status, author_name, reviewed_at, created_at) values ('00000000-0000-4000-8000-000000000107', 1, 'Propuesta inicial enviada al cliente.', 'aprobada', 'JuanGa', (date_trunc('day', now()) - interval '68 days' + time '09:00'), (date_trunc('day', now()) - interval '70 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000107', 'legal', 'RUT_RP.pdf', 191370, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000107', 'legal', 'Camara_comercio_RP.pdf', 301014, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000107', 'legal', 'Cert_bancario_RP.pdf', 282740, true, (date_trunc('day', now()) - interval '60 days' + time '09:00'));
insert into public.documents (sponsor_id, kind, name, size_bytes, verified, created_at) values ('00000000-0000-4000-8000-000000000107', 'contrato', 'Contrato_RP_firmado.pdf', 412000, true, current_date - 60);
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'espacio-en-m2', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'apadrinamientos-de-startups', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'ingresos-generales-tickets-2-dias', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'patrocinio-del-espacio-de-pitch-session', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'imagen-en-pantalla-principal-itinerante', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'imagen-en-pagina-web-del-evento', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'valla-de-agradecimiento', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'marketing-digital-en-redes-sociales', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'imagen-y-nota-en-newsletter-starter-mailing-masivo', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'mencion-en-boletin-de-prensa-30-medios', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'imagen-en-escarapela-del-evento', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'imagen-en-networking-previo-al-evento', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'marca-en-sala-vip-5-accesos', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'espacio-de-marca-en-talleres-de-preparacion', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'patrocinio-con-material-pop-para-270-startups', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'marca-en-hasta-5-vallas-de-senalizacion', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'marca-en-pantallas-durante-el-ranking', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'intervencion-durante-el-evento-5-min', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'video-institucional-30s-1x-por-dia', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'mencion-en-kit-de-prensa-y-medios', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'webinar-a-corporativos-post-evento-6-meses', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'envio-exclusivo-a-comunidad-27-000-usuarios', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'espacio-segundo-piso-30-personas', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'intervencion-noche-previa-networking-400-inv', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'base-de-datos-de-asistentes-generales', true, now() - interval '1 day');
insert into public.commitment_status (sponsor_id, commitment_key, done, done_at) values ('00000000-0000-4000-8000-000000000107', 'base-de-datos-de-startups-de-la-muestra', true, now() - interval '1 day');

delete from public.activity where sponsor_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000107');
insert into public.activity (sponsor_id, kind, text, actor_name, internal, created_at)
select c.sponsor_id, 'comment', c.author_name || ' escribió en ' || s.name, c.author_name, false, c.created_at
  from public.comments c join public.sponsors s on s.id = c.sponsor_id where s.event_id = '00000000-0000-4000-8000-000000000001';
insert into public.activity (sponsor_id, kind, text, actor_name, internal, created_at)
select a.sponsor_id, 'asset', s.name || ' aprobó ' || a.name, s.contact_name, false, a.reviewed_at
  from public.assets a join public.sponsors s on s.id = a.sponsor_id where a.status = 'aprobado' and s.event_id = '00000000-0000-4000-8000-000000000001';
commit;
