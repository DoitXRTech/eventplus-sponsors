-- Workaround del bug real de sponsors_team_insert (ver 0013): el INSERT en sponsors sigue
-- fallando contra RLS sin importar la forma del check (probado con la columna directa y con
-- el join al evento) -- el mismo UPDATE, con la misma condicion, funciona perfecto. Es una
-- interaccion puntual entre RLS y el trigger que completa organization_id, especifica de
-- insertar en esta tabla, que no se pudo resolver ajustando la policy declarativa.
--
-- En vez de seguir ahi, se mueve el alta a una funcion RPC security definer -- el mismo
-- patron que ya usan review_asset/review_proposal/set_sponsor_logo para lo que necesita
-- mas que un chequeo declarativo. Corre como el dueno de la funcion (bypassa RLS en sponsors
-- a proposito) y hace su propio chequeo de permisos adentro, en PL/pgSQL en vez de en una
-- policy -- el trigger que completa organization_id sigue corriendo igual, eso no cambia.

create or replace function public.create_sponsor(
  p_event_id uuid, p_name text, p_initials text, p_tier text, p_value_cop bigint,
  p_sector text default '', p_contact_name text default '', p_contact_role text default '',
  p_contact_email text default '', p_contact_phone text default ''
) returns public.sponsors
language plpgsql security definer set search_path = public as $$
declare s public.sponsors; v_org uuid;
begin
  if not public.is_team() then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  select organization_id into v_org from public.events where id = p_event_id;
  if v_org is null or v_org <> public.my_org_id() then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  insert into public.sponsors (event_id, name, initials, tier, value_cop, sector, contact_name, contact_role, contact_email, contact_phone)
  values (p_event_id, p_name, p_initials, p_tier, p_value_cop, p_sector, p_contact_name, p_contact_role, p_contact_email, p_contact_phone)
  returning * into s;
  return s;
end $$;

revoke all on function public.create_sponsor(uuid, text, text, text, bigint, text, text, text, text, text) from public;
grant execute on function public.create_sponsor(uuid, text, text, text, bigint, text, text, text, text, text) to authenticated;
