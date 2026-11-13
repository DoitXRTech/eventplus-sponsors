-- Admin de plataforma: un rol por encima de las organizaciones, para dar de alta
-- organizadores nuevos desde un formulario en vez de correr scripts locales a mano.
-- Vive aparte de profiles (un admin de plataforma no pertenece a ninguna organizacion,
-- las ve/crea todas) y su alcance queda angosto a proposito: solo organizations y events
-- (lo que necesita el alta), nunca sponsors/assets/comments/etc de ningun tenant.

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- A proposito sin policies: nadie lee ni escribe esta tabla directo, ni siquiera el dueño
-- de la fila. Solo is_platform_admin() (security definer) la consulta. Dar de alta un admin
-- nuevo se hace a mano por SQL (insert directo), nunca desde la app.

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated, service_role;

-- organizations: el admin de plataforma ve y crea organizaciones. Sin delete por ahora,
-- para que un formulario no pueda borrar una organizacion con datos reales adentro.
drop policy if exists organizations_platform_admin_read on public.organizations;
create policy organizations_platform_admin_read on public.organizations for select to authenticated
  using (public.is_platform_admin());

drop policy if exists organizations_platform_admin_insert on public.organizations;
create policy organizations_platform_admin_insert on public.organizations for insert to authenticated
  with check (public.is_platform_admin());

-- events: solo insertar el primer evento de la organizacion nueva. Editarlo despues es
-- trabajo del equipo de esa organizacion (events_team_write ya lo cubre), no del admin.
drop policy if exists events_platform_admin_insert on public.events;
create policy events_platform_admin_insert on public.events for insert to authenticated
  with check (public.is_platform_admin());
