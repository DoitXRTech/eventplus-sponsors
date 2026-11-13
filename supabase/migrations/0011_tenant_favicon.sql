-- Favicon por organizacion: mismo mecanismo que el logo (mismo bucket org-logos, carpeta
-- <org_id>/favicon/..., ya permitida por la policy org_logos_write que solo mira el primer
-- segmento del path, no el segundo -- no hace falta tocar storage para esto).

alter table public.organizations add column if not exists favicon_path text;

-- favicon_path va al final: CREATE OR REPLACE VIEW no deja insertar una columna en medio
-- del orden existente (solo agregar al final), solo renombrar/quitar con DROP + CREATE.
create or replace view public.organizations_public as
  select slug, name, logo_path, color_primary, color_accent, favicon_path from public.organizations;
grant select on public.organizations_public to anon, authenticated;
