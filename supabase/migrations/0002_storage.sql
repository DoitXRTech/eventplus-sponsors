-- Bucket privado para archivos de patrocinadores: <sponsor_id>/<carpeta>/<archivo>.
-- El equipo lee y escribe todo; el patrocinador solo dentro de su carpeta.

insert into storage.buckets (id, name, public, file_size_limit)
values ('sponsor-files', 'sponsor-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists sponsor_files_read on storage.objects;
drop policy if exists sponsor_files_insert on storage.objects;
drop policy if exists sponsor_files_update on storage.objects;
drop policy if exists sponsor_files_delete on storage.objects;

create policy sponsor_files_read on storage.objects for select to authenticated
  using (bucket_id = 'sponsor-files' and (
    public.is_team() or (storage.foldername(name))[1] = public.my_sponsor_id()::text));

-- El patrocinador sube logo, documentos legales, adjuntos de chat; nunca contratos ni piezas.
create policy sponsor_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsor-files' and (
    public.is_team() or (
      (storage.foldername(name))[1] = public.my_sponsor_id()::text
      and (storage.foldername(name))[2] in ('logo', 'legal', 'chat'))));

create policy sponsor_files_update on storage.objects for update to authenticated
  using (bucket_id = 'sponsor-files' and public.is_team()) with check (bucket_id = 'sponsor-files' and public.is_team());

create policy sponsor_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sponsor-files' and public.is_team());
