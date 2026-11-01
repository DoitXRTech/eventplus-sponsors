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
grant execute on function public.review_asset(uuid, text, text), public.review_proposal(uuid, text, text),
  public.set_sponsor_logo(uuid, text), public.is_team(), public.my_sponsor_id(), public.can_see_sponsor(uuid),
  public.tier_ticket_capacity(text), public.tier_startup_capacity(text) to authenticated;
