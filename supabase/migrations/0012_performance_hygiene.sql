-- Limpieza de advisories de performance/hygiene (ninguno de seguridad, ninguno bloqueante):
--
-- 1. 7 foreign keys sin índice de respaldo: cada join/delete por esa columna hacía un
--    sequential scan. Se agregan los índices que faltaban.
--
-- 2. 4 funciones sin "set search_path": a diferencia del resto del esquema, estas quedaron
--    sin fijarlo cuando se escribieron. Mismo comportamiento, solo más seguras.
--
-- 3. "Multiple permissive policies": en assets/commitment_status/profiles/proposals/sponsors
--    había una policy "_read" (solo select) y otra "_team_write" (for all, que YA cubre
--    select también) -- Postgres evaluaba las dos en cada select de un usuario de equipo.
--    Se separa "_team_write" en insert/update/delete nada más; "_read" queda como la única
--    policy de select (el equipo ya cumple su condición igual, es subconjunto exacto de
--    "_read"). En events y organizations se funde directamente la condición del admin de
--    plataforma con la del equipo en una sola policy por accion, en vez de dos separadas.

-- 1. Índices faltantes -------------------------------------------------------------------
create index if not exists activity_sponsor_idx on public.activity(sponsor_id);
create index if not exists assets_created_by_idx on public.assets(created_by);
create index if not exists assets_reviewed_by_idx on public.assets(reviewed_by);
create index if not exists comments_author_id_idx on public.comments(author_id);
create index if not exists documents_created_by_idx on public.documents(created_by);
create index if not exists profiles_sponsor_id_idx on public.profiles(sponsor_id);
create index if not exists prospects_event_id_idx on public.prospects(event_id);

-- 2. search_path fijo en las 4 funciones que no lo tenían --------------------------------
create or replace function public.stage_label(s text) returns text
language sql immutable set search_path = public as $$
  select case s when 'kickoff' then 'Kickoff' when 'contract' then 'Contrato' when 'production' then 'Producción'
    when 'approvals' then 'Aprobaciones' when 'sponsoring' then 'Apadrinamientos'
    when 'ready' then 'Listo para evento' when 'post' then 'Post-evento' else s end;
$$;

create or replace function public.sponsor_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stage is distinct from old.stage then new.stage_changed_at := now(); end if;
  if new.contract_status = 'Firmado' and old.contract_status is distinct from 'Firmado'
     and new.contract_signed_at is null then
    new.contract_signed_at := current_date;
  end if;
  return new;
end $$;

create or replace function public.tier_ticket_capacity(t text) returns int
language sql immutable set search_path = public as $$
  select case t when 'Partner' then 200 when 'Unicorn' then 150 when 'Serie B' then 100
    when 'Serie A' then 80 when 'Seed' then 60 when 'Preseed' then 30 when 'Founders' then 15 else 0 end;
$$;

create or replace function public.tier_startup_capacity(t text) returns int
language sql immutable set search_path = public as $$
  select case t when 'Partner' then 5 when 'Unicorn' then 4 when 'Serie B' then 3
    when 'Serie A' then 2 when 'Seed' then 1 else 0 end;
$$;

-- 3. Consolidar policies de select duplicadas ---------------------------------------------
drop policy if exists assets_team_write on public.assets;
create policy assets_team_insert on public.assets for insert to authenticated with check (public.is_team() and public.can_see_sponsor(sponsor_id));
create policy assets_team_update on public.assets for update to authenticated using (public.is_team() and public.can_see_sponsor(sponsor_id)) with check (public.is_team() and public.can_see_sponsor(sponsor_id));
create policy assets_team_delete on public.assets for delete to authenticated using (public.is_team() and public.can_see_sponsor(sponsor_id));

drop policy if exists commitments_team_write on public.commitment_status;
create policy commitments_team_insert on public.commitment_status for insert to authenticated with check (public.is_team() and public.can_see_sponsor(sponsor_id));
create policy commitments_team_update on public.commitment_status for update to authenticated using (public.is_team() and public.can_see_sponsor(sponsor_id)) with check (public.is_team() and public.can_see_sponsor(sponsor_id));
create policy commitments_team_delete on public.commitment_status for delete to authenticated using (public.is_team() and public.can_see_sponsor(sponsor_id));

drop policy if exists profiles_team_write on public.profiles;
create policy profiles_team_insert on public.profiles for insert to authenticated with check (public.is_team() and organization_id = public.my_org_id());
create policy profiles_team_update on public.profiles for update to authenticated using (public.is_team() and organization_id = public.my_org_id()) with check (public.is_team() and organization_id = public.my_org_id());
create policy profiles_team_delete on public.profiles for delete to authenticated using (public.is_team() and organization_id = public.my_org_id());

drop policy if exists proposals_team_write on public.proposals;
create policy proposals_team_insert on public.proposals for insert to authenticated with check (public.is_team() and public.can_see_sponsor(sponsor_id));
create policy proposals_team_update on public.proposals for update to authenticated using (public.is_team() and public.can_see_sponsor(sponsor_id)) with check (public.is_team() and public.can_see_sponsor(sponsor_id));
create policy proposals_team_delete on public.proposals for delete to authenticated using (public.is_team() and public.can_see_sponsor(sponsor_id));

drop policy if exists sponsors_team_write on public.sponsors;
create policy sponsors_team_insert on public.sponsors for insert to authenticated with check (public.is_team() and organization_id = public.my_org_id());
create policy sponsors_team_update on public.sponsors for update to authenticated using (public.is_team() and organization_id = public.my_org_id()) with check (public.is_team() and organization_id = public.my_org_id());
create policy sponsors_team_delete on public.sponsors for delete to authenticated using (public.is_team() and organization_id = public.my_org_id());

-- events: funde events_platform_admin_insert + events_team_write (el insert) en una sola;
-- events_read ya alcanza sola para select (events_team_write era subconjunto exacto).
drop policy if exists events_team_write on public.events;
drop policy if exists events_platform_admin_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check ((public.is_team() and organization_id = public.my_org_id()) or public.is_platform_admin());
create policy events_team_update on public.events for update to authenticated
  using (public.is_team() and organization_id = public.my_org_id()) with check (public.is_team() and organization_id = public.my_org_id());
create policy events_team_delete on public.events for delete to authenticated
  using (public.is_team() and organization_id = public.my_org_id());

-- organizations: funde organizations_read + organizations_platform_admin_read en una sola.
drop policy if exists organizations_read on public.organizations;
drop policy if exists organizations_platform_admin_read on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using (id = public.my_org_id() or public.is_platform_admin());
