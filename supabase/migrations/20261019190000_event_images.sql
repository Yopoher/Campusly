-- Phase 4 : images d'événements (docs/SECURITY.md §5.3).
-- Bucket privé « event-images ». Chemin : <école>/<événement>/<uuid>.webp, généré par le serveur.
-- Les clients n'ont aucun accès direct hors de ces politiques : lecture, ajout et suppression
-- sont limités aux membres de l'école qui peuvent voir l'événement (lecture) ou le modifier (écriture).
-- L'enregistrement du chemin dans events.image_path passe par set_event_image (SECURITY DEFINER, audit).

-- ---------------------------------------------------------------- bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', false, 4194304, array['image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------- politiques Storage
-- Le chemin doit respecter le format généré par le serveur ; sinon l'objet n'est ni lisible ni inscriptible.
drop policy if exists event_images_read on storage.objects;
create policy event_images_read on storage.objects for select to authenticated
  using (
    bucket_id = 'event-images'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    and (storage.foldername(name))[1] = current_school_id()::text
    -- La sous-requête passe par events_read : un brouillon n'est visible que de son organisation.
    and exists (select 1 from events e where e.id::text = (storage.foldername(name))[2])
  );

drop policy if exists event_images_insert on storage.objects;
create policy event_images_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    and (storage.foldername(name))[1] = current_school_id()::text
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[2]
        and e.status <> 'cancelled'
        and has_org_permission(e.organization_id, 'events.edit'))
  );

drop policy if exists event_images_delete on storage.objects;
create policy event_images_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-images'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    and (storage.foldername(name))[1] = current_school_id()::text
    and exists (
      select 1 from events e
      where e.id::text = (storage.foldername(name))[2]
        and has_org_permission(e.organization_id, 'events.edit'))
  );

-- ---------------------------------------------------------------- enregistrement du chemin
-- p_path = null retire l'image. Renvoie le chemin précédent pour que le serveur supprime l'objet.
create or replace function set_event_image(p_event uuid, p_path text) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_previous text;
begin
  select * into v_event from events where id = p_event for update;
  if not found then raise exception 'Événement introuvable' using errcode = 'P0002'; end if;
  perform assert_event_permission(v_event.organization_id, 'events.edit');

  if v_event.status = 'cancelled' then
    raise exception 'Un événement annulé ne peut plus être modifié' using errcode = 'P0001';
  end if;

  if p_path is not null then
    -- Le chemin doit désigner un objet de cet événement, dans l'école de l'événement, et exister.
    if p_path !~ ('^' || v_event.school_id::text || '/' || v_event.id::text || '/[0-9a-f-]{36}\.webp$') then
      raise exception 'Image refusée : chemin invalide' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'event-images' and name = p_path) then
      raise exception 'Image introuvable : envoie-la à nouveau' using errcode = 'P0002';
    end if;
  end if;

  v_previous := v_event.image_path;
  update events set image_path = p_path, updated_by = auth.uid() where id = p_event;

  perform write_audit(v_event.school_id, 'event.image_changed', 'event', p_event::text,
                      jsonb_build_object('removed', p_path is null));
  return v_previous;
end $$;

-- ---------------------------------------------------------------- droits
revoke all on function set_event_image(uuid, text) from public, anon;
grant execute on function set_event_image(uuid, text) to authenticated;
