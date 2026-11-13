-- 0008 dejo platform_admins sin ningun grant: RLS sin policies bloquea el acceso de
-- cualquier rol a nivel de permisos de tabla, incluso al service_role (que bypassa RLS
-- pero no los GRANT de Postgres). service_role es quien gestiona esta tabla (scripts/
-- create-platform-admin.mjs y la Edge Function admin-console), asi que necesita el grant.
grant select, insert, update on public.platform_admins to service_role;
