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
