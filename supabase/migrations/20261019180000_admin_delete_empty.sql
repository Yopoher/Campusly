-- Suppression définitive, seulement pour les organisations et écoles vides.
-- Une organisation avec des événements, ou une école avec des personnes, des adresses, des organisations ou des événements,
-- ne peut pas être supprimée : il faut la désactiver. Le journal d'audit est conservé (sans lien avec l'école supprimée).
create or replace function admin_delete_organization(p_org uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_org organizations;
begin
  perform assert_platform_admin();
  select * into v_org from organizations where id = p_org;
  if not found then raise exception 'Organisation introuvable' using errcode = 'P0002'; end if;
  if v_org.type = 'school' then
    raise exception 'L''organisation École ne se supprime pas' using errcode = '22023';
  end if;
  if exists (select 1 from events where organization_id = p_org) then
    raise exception 'Cette organisation a des événements : désactive-la au lieu de la supprimer' using errcode = '22023';
  end if;

  perform write_audit(v_org.school_id, 'organization.deleted', 'organization', p_org::text,
                      jsonb_build_object('name', v_org.name));
  delete from organizations where id = p_org;
end $$;

create or replace function admin_delete_school(p_school uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_school schools;
begin
  perform assert_platform_admin();
  select * into v_school from schools where id = p_school;
  if not found then raise exception 'École introuvable' using errcode = 'P0002'; end if;
  if exists (select 1 from profiles where school_id = p_school)
     or exists (select 1 from allowed_emails where school_id = p_school)
     or exists (select 1 from events where school_id = p_school)
     or exists (select 1 from organizations where school_id = p_school and type <> 'school') then
    raise exception 'Cette école n''est pas vide : désactive-la, ou retire d''abord ses adresses, organisations et événements'
      using errcode = '22023';
  end if;

  -- Le journal est conservé ; il n'est plus rattaché à l'école supprimée.
  update audit_logs set school_id = null where school_id = p_school;
  perform write_audit(null, 'school.deleted', 'school', p_school::text, jsonb_build_object('name', v_school.name));

  delete from import_batches where school_id = p_school;
  delete from organizations where school_id = p_school;
  delete from schools where id = p_school;
end $$;

revoke all on function admin_delete_organization(uuid), admin_delete_school(uuid) from public, anon, authenticated;
grant execute on function admin_delete_organization(uuid), admin_delete_school(uuid) to authenticated;
