-- Identidad visual por organizacion: logo y 2 colores, para pintar login/sidebar/portal
-- antes incluso de loguearse (se resuelve por el primer segmento del path, ej. /acme/...).
-- StartCo arranca con sus colores de siempre, para no cambiarle nada a quien ya usa la app.

alter table public.organizations add column if not exists logo_path text;
alter table public.organizations add column if not exists color_primary text;
alter table public.organizations add column if not exists color_accent text;

update public.organizations set color_primary = '#0F1419', color_accent = '#C93D0C'
  where slug = 'startco' and color_primary is null;

-- Vista publica: el branding no es informacion sensible (se ve en el login, sin sesion),
-- pero el resto de organizations sigue restringido a la propia organizacion. Una vista
-- corre con los permisos de quien la crea (no los de quien la consulta), asi que expone
-- estas 5 columnas igual aunque organizations tenga RLS mas angosto.
create or replace view public.organizations_public as
  select slug, name, logo_path, color_primary, color_accent from public.organizations;
grant select on public.organizations_public to anon, authenticated;

-- El equipo de cada organizacion edita su propia marca (antes no habia ningun update en
-- absoluto sobre organizations: solo el admin de plataforma podia insertar/leer todas).
drop policy if exists organizations_team_update on public.organizations;
create policy organizations_team_update on public.organizations for update to authenticated
  using (public.is_team() and id = public.my_org_id())
  with check (public.is_team() and id = public.my_org_id());

-- Bucket publico: el logo se ve en el login, sin sesion -- no tiene sentido una URL firmada.
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do update set public = true;

drop policy if exists org_logos_write on storage.objects;
create policy org_logos_write on storage.objects for all to authenticated
  using (bucket_id = 'org-logos' and public.is_team() and (storage.foldername(name))[1] = public.my_org_id()::text)
  with check (bucket_id = 'org-logos' and public.is_team() and (storage.foldername(name))[1] = public.my_org_id()::text);
