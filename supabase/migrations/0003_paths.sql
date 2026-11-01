-- Toda ruta de archivo vive en <sponsor_id>/<carpeta>/: una fila nunca puede apuntar al
-- archivo de otro patrocinador ni a una carpeta que no le corresponde.

alter table public.documents drop constraint if exists documents_path_ok;
alter table public.documents add constraint documents_path_ok check (
  file_path is null or (split_part(file_path, '/', 1) = sponsor_id::text and split_part(file_path, '/', 2) = kind));

alter table public.assets drop constraint if exists assets_path_ok;
alter table public.assets add constraint assets_path_ok check (
  file_path is null or (split_part(file_path, '/', 1) = sponsor_id::text and split_part(file_path, '/', 2) = 'piezas'));

alter table public.proposals drop constraint if exists proposals_path_ok;
alter table public.proposals add constraint proposals_path_ok check (
  file_path is null or (split_part(file_path, '/', 1) = sponsor_id::text and split_part(file_path, '/', 2) = 'propuesta'));

alter table public.comments drop constraint if exists comments_path_ok;
alter table public.comments add constraint comments_path_ok check (
  attachment_path is null or (split_part(attachment_path, '/', 1) = sponsor_id::text and split_part(attachment_path, '/', 2) = 'chat'));

alter table public.sponsors drop constraint if exists sponsors_logo_path_ok;
alter table public.sponsors add constraint sponsors_logo_path_ok check (
  logo_path is null or (split_part(logo_path, '/', 1) = id::text and split_part(logo_path, '/', 2) = 'logo'));
