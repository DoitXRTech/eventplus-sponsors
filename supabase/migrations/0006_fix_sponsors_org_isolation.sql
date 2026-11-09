-- 0005_multitenant.sql reescribio sponsors_read para que use can_see_sponsor(id) (ya quedo
-- org-aware), pero nunca toco sponsors_team_write: siguio siendo "is_team()" a secas, sin
-- organization_id. Como las politicas RLS se combinan con OR, esa sola bastaba para que
-- cualquier equipo de cualquier organizacion viera y editara los sponsors de las demas -
-- encontrado con rls-check.mjs al correr el bloque de aislamiento cruzado (create-org.mjs).

drop policy if exists sponsors_team_write on public.sponsors;
create policy sponsors_team_write on public.sponsors for all to authenticated
  using (public.is_team() and organization_id = public.my_org_id())
  with check (public.is_team() and organization_id = public.my_org_id());
