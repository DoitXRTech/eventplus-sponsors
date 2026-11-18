-- Archivos de patrocinadores (bucket sponsor-files): el equipo no podia leer, subir,
-- reemplazar ni borrar ningun archivo desde 0005_multitenant.
--
-- Causa: dentro de "exists (select 1 from public.sponsors sp where ... (storage.foldername(name))[1])"
-- el "name" sin calificar se resolvia contra sponsors.name (el nombre del patrocinador, ej.
-- "Sende Corp"), no contra storage.objects.name (la ruta del archivo): Postgres busca las
-- columnas primero en la subconsulta. La condicion nunca se cumplia para el equipo; al
-- patrocinador le andaba porque su rama esta fuera de la subconsulta. Sintoma: "No se pudo
-- abrir el archivo" (400 al firmar la URL) y subidas del equipo que fallaban.
--
-- Mismas reglas que 0005, con la ruta calificada como objects.name en todas las ramas.

drop policy if exists sponsor_files_read on storage.objects;
create policy sponsor_files_read on storage.objects for select to authenticated
  using (bucket_id = 'sponsor-files' and (
    (public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(objects.name))[1]))
    or (storage.foldername(objects.name))[1] = public.my_sponsor_id()::text));

drop policy if exists sponsor_files_insert on storage.objects;
create policy sponsor_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsor-files' and (
    (public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(objects.name))[1]))
    or (
      (storage.foldername(objects.name))[1] = public.my_sponsor_id()::text
      and (storage.foldername(objects.name))[2] in ('logo', 'legal', 'chat'))));

drop policy if exists sponsor_files_update on storage.objects;
create policy sponsor_files_update on storage.objects for update to authenticated
  using (bucket_id = 'sponsor-files' and public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(objects.name))[1]))
  with check (bucket_id = 'sponsor-files' and public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(objects.name))[1]));

drop policy if exists sponsor_files_delete on storage.objects;
create policy sponsor_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sponsor-files' and public.is_team() and exists (select 1 from public.sponsors sp where sp.organization_id = public.my_org_id() and sp.id::text = (storage.foldername(objects.name))[1]));
