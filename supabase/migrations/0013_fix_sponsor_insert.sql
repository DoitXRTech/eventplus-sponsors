-- Bug real encontrado probando el alta de un patrocinador nuevo con una sesion real: el
-- check de sponsors_team_insert (y el with check de sponsors_team_update) comparaban
-- organization_id, pero esa columna la completa sponsor_org_sync() -- un trigger que corre
-- recien al insertar/actualizar event_id. El motor de este proyecto evalua el WITH CHECK de
-- RLS con el valor de ANTES de que el trigger la complete, asi que organization_id llegaba
-- vacia al chequeo y el alta se rechazaba siempre, para cualquier equipo de cualquier
-- organizacion. No es algo que haya roto la consolidacion de policies de 0012: el mismo
-- problema ya estaba en el check combinado desde 0006 (nunca se habia probado un alta real,
-- solo cambios de etapa). Se valida contra el evento -- que el cliente si manda, nunca lo
-- pone un trigger -- en vez de contra la columna que la completa despues.

drop policy if exists sponsors_team_insert on public.sponsors;
create policy sponsors_team_insert on public.sponsors for insert to authenticated
  with check (public.is_team() and exists (
    select 1 from public.events e where e.id = event_id and e.organization_id = public.my_org_id()
  ));

drop policy if exists sponsors_team_update on public.sponsors;
create policy sponsors_team_update on public.sponsors for update to authenticated
  using (public.is_team() and organization_id = public.my_org_id())
  with check (public.is_team() and exists (
    select 1 from public.events e where e.id = event_id and e.organization_id = public.my_org_id()
  ));
