-- Invitation de super-administrateur : si l'adresse a déjà un compte (connexion faite avant l'invitation),
-- le super-administrateur est activé tout de suite. Sinon l'invitation attend la première connexion.
-- Remplace invite_platform_admin de la migration 20261015170000 (version qui ne traitait que les nouveaux comptes).
drop function if exists invite_platform_admin(text);

create function invite_platform_admin(p_email text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := normalize_email(p_email);
  v_user  uuid;
begin
  select id into v_user from auth.users where lower(email) = v_email limit 1;
  if v_user is null then
    insert into platform_admin_invites (email) values (v_email) on conflict do nothing;
  else
    insert into platform_admins (user_id) values (v_user) on conflict do nothing;
    delete from platform_admin_invites where email = v_email;
    insert into audit_logs (actor_id, action, target_type, target_id)
    values (null, 'platform_admin.activated', 'user', v_user::text);
  end if;
end $$;

revoke all on function invite_platform_admin(text) from public, anon, authenticated;
grant execute on function invite_platform_admin(text) to service_role;
