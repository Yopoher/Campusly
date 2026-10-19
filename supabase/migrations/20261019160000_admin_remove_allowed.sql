-- Remplacement d'une liste d'étudiants : retire de la liste autorisée les adresses absentes du nouveau fichier.
-- Le retrait déclenche la mise en « non autorisé » des comptes (sync_profile_authorization). La révocation des sessions
-- est faite par le serveur (clé service_role, côté serveur uniquement), à partir de la liste renvoyée ici.
create or replace function admin_remove_allowed_emails(p_school uuid, p_keep text[])
  returns text[] language plpgsql security definer set search_path = public as $$
declare
  v_removed text[];
begin
  perform assert_platform_admin();
  if not exists (select 1 from schools where id = p_school) then
    raise exception 'École introuvable' using errcode = 'P0002';
  end if;
  -- Garde-fou : un fichier vide ou invalide ne doit jamais vider la liste.
  if p_keep is null or cardinality(p_keep) = 0 then
    raise exception 'Liste de remplacement vide : aucune adresse retirée' using errcode = '22023';
  end if;

  with gone as (
    update allowed_emails set status = 'removed', removed_at = now()
    where school_id = p_school and status = 'authorized' and not (email = any (p_keep))
    returning email
  )
  select coalesce(array_agg(email order by email), '{}') into v_removed from gone;

  perform write_audit(p_school, 'allowed_emails.removed', 'school', p_school::text,
                      jsonb_build_object('count', cardinality(v_removed)));
  return v_removed;
end $$;

revoke all on function admin_remove_allowed_emails(uuid, text[]) from public, anon, authenticated;
grant execute on function admin_remove_allowed_emails(uuid, text[]) to authenticated;
