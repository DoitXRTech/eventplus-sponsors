-- Limpieza de los advisories de Supabase (seguridad/performance), ninguno bloqueante:
--
-- 1. profiles_read y comments_insert llamaban a auth.uid() directo en la policy, que
--    Postgres reevalua fila por fila. Con (select auth.uid()) el planner lo cachea una
--    sola vez por consulta - mismo resultado, mas rapido a escala.
--
-- 2. Las funciones de abajo (helpers, RPCs y triggers) quedaban ejecutables por "anon"
--    via PostgREST porque CREATE FUNCTION otorga EXECUTE a PUBLIC por defecto y nunca
--    se revoco. Ya fallan seguro para anon internamente (auth.uid() da null y las que
--    chequean perfil tiran NO_AUTORIZADO), pero no hay razon para dejarlas expuestas a
--    quien no inicio sesion. Se revoca de PUBLIC y se vuelve a otorgar solo a
--    authenticated/service_role - mismo comportamiento para usuarios reales.

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (organization_id = public.my_org_id() and (public.is_team() or kind = 'team' or sponsor_id = public.my_sponsor_id())));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_see_sponsor(sponsor_id)
    and ((public.is_team() and team = 'startco') or ((not public.is_team()) and team = 'sponsor' and not internal)));

revoke execute on function public.actor_name() from public;
revoke execute on function public.asset_activity() from public;
revoke execute on function public.can_see_sponsor(uuid) from public;
revoke execute on function public.comment_activity() from public;
revoke execute on function public.enforce_attendee_capacity() from public;
revoke execute on function public.enforce_startup_capacity() from public;
revoke execute on function public.is_team() from public;
revoke execute on function public.my_org_id() from public;
revoke execute on function public.my_sponsor_id() from public;
revoke execute on function public.profile_org_sync() from public;
revoke execute on function public.review_asset(uuid, text, text) from public;
revoke execute on function public.review_proposal(uuid, text, text) from public;
revoke execute on function public.set_sponsor_logo(uuid, text) from public;
revoke execute on function public.sponsor_after_update() from public;
revoke execute on function public.sponsor_org_sync() from public;
revoke execute on function public.startup_activity() from public;

grant execute on function public.actor_name() to authenticated, service_role;
grant execute on function public.asset_activity() to authenticated, service_role;
grant execute on function public.can_see_sponsor(uuid) to authenticated, service_role;
grant execute on function public.comment_activity() to authenticated, service_role;
grant execute on function public.enforce_attendee_capacity() to authenticated, service_role;
grant execute on function public.enforce_startup_capacity() to authenticated, service_role;
grant execute on function public.is_team() to authenticated, service_role;
grant execute on function public.my_org_id() to authenticated, service_role;
grant execute on function public.my_sponsor_id() to authenticated, service_role;
grant execute on function public.profile_org_sync() to authenticated, service_role;
grant execute on function public.review_asset(uuid, text, text) to authenticated, service_role;
grant execute on function public.review_proposal(uuid, text, text) to authenticated, service_role;
grant execute on function public.set_sponsor_logo(uuid, text) to authenticated, service_role;
grant execute on function public.sponsor_after_update() to authenticated, service_role;
grant execute on function public.sponsor_org_sync() to authenticated, service_role;
grant execute on function public.startup_activity() to authenticated, service_role;
