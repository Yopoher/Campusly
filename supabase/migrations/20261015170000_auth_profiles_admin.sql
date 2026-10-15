-- Campusly — Phase 3 : connexion, profils, administration.
-- Documentation : docs/SECURITY.md §2 et §3. Tests : tests/db/auth.test.ts, tests/db/admin.test.ts.

-- ================================================================ utilitaires
create or replace function normalize_email(p text) returns text
  language sql immutable as $$ select lower(btrim(p)) $$;

create or replace function email_hash(p text) returns text
  language sql immutable as $$ select encode(sha256(convert_to(normalize_email(p), 'UTF8')), 'hex') $$;

-- ================================================================ invitations super-admin
-- Une invitation permet à une adresse hors liste d'école de se connecter une première fois ;
-- le compte devient alors super-admin et l'invitation est consommée.
create table platform_admin_invites (
  email      text primary key check (email = normalize_email(email) and email like '%_@_%.__%'),
  created_at timestamptz not null default now()
);
alter table platform_admin_invites enable row level security; -- aucune politique : serveur uniquement

-- ================================================================ contrôle avant connexion
create or replace function can_request_login(p_email text) returns boolean
  language sql stable security definer set search_path = public as $$
  with e as (select normalize_email(p_email) as email)
  select
    -- adresse autorisée d'une école active, domaine cohérent, compte non bloqué
    exists (
      select 1 from e
      join allowed_emails a on a.email = e.email and a.status = 'authorized'
      join schools s on s.id = a.school_id and s.status = 'active'
      join school_domains d on d.school_id = s.id and d.domain = split_part(e.email, '@', 2)
      where not exists (select 1 from profiles p where p.email = e.email and p.status <> 'active'))
    -- ou super-admin invité / existant
    or exists (select 1 from e join platform_admin_invites i on i.email = e.email)
    or exists (select 1 from e join auth.users u on lower(u.email) = e.email
               join platform_admins pa on pa.user_id = u.id)
$$;

-- Appelée par le serveur avant tout envoi de code : limitation des demandes puis contrôle.
-- Renvoie 'ok', 'denied' ou 'throttled'. Le serveur affiche le même message pour 'ok' et 'denied'.
create or replace function login_precheck(p_email text, p_ip_hash text default null) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_hash text := email_hash(p_email);
begin
  if (select count(*) from login_attempts where email_hash = v_hash and created_at > now() - interval '1 hour') >= 5
     or (p_ip_hash is not null and
         (select count(*) from login_attempts where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 20)
  then
    return 'throttled';
  end if;
  insert into login_attempts (email_hash, ip_hash) values (v_hash, p_ip_hash);
  return case when can_request_login(p_email) then 'ok' else 'denied' end;
end $$;

-- Hook Supabase Auth « before user created » : même contrôle, appliqué par le service d'authentification.
create or replace function hook_before_user_created(event jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
begin
  if can_request_login(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Cette adresse ne permet pas de se connecter à Campusly.'));
end $$;

-- ================================================================ création du compte
create or replace function handle_new_auth_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_email text := normalize_email(new.email);
  v_count int;
  v_row   allowed_emails;
begin
  -- super-admin invité
  if exists (select 1 from platform_admin_invites where email = v_email) then
    insert into platform_admins (user_id) values (new.id) on conflict do nothing;
    delete from platform_admin_invites where email = v_email;
    insert into audit_logs (actor_id, action, target_type, target_id)
    values (new.id, 'platform_admin.activated', 'user', new.id::text);
  end if;

  -- profil d'école
  select count(*) into v_count
  from allowed_emails a join schools s on s.id = a.school_id and s.status = 'active'
  where a.email = v_email and a.status = 'authorized';

  if v_count > 1 then
    raise exception 'Adresse autorisée dans plusieurs écoles : rattachement impossible' using errcode = 'P0001';
  elsif v_count = 1 then
    select a.* into v_row
    from allowed_emails a join schools s on s.id = a.school_id and s.status = 'active'
    where a.email = v_email and a.status = 'authorized';

    insert into profiles (id, school_id, email, person_type, first_name, last_name)
    values (new.id, v_row.school_id, v_email, v_row.person_type,
            coalesce(btrim(v_row.first_name), ''), coalesce(btrim(v_row.last_name), ''))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Retrait / ré-autorisation d'une adresse : le statut du profil suit (les sessions sont révoquées par le serveur).
create or replace function sync_profile_authorization() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'removed' and old.status = 'authorized' then
    update profiles set status = 'unauthorized'
    where email = new.email and school_id = new.school_id and status = 'active';
  elsif new.status = 'authorized' and old.status = 'removed' then
    update profiles set status = 'active'
    where email = new.email and school_id = new.school_id and status = 'unauthorized';
  end if;
  return new;
end $$;

create trigger trg_allowed_emails_sync after update of status on allowed_emails
  for each row execute function sync_profile_authorization();

-- ================================================================ profil de l'utilisateur
create or replace function update_my_profile(p_first_name text, p_last_name text, p_bio text default null)
  returns profiles language plpgsql security definer set search_path = public as $$
declare
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last  text := btrim(coalesce(p_last_name, ''));
  v_bio   text := nullif(btrim(coalesce(p_bio, '')), '');
  v_profile profiles;
begin
  if current_school_id() is null then raise exception 'Compte inactif' using errcode = '42501'; end if;
  if length(v_first) not between 1 and 60 then raise exception 'Le prénom doit contenir entre 1 et 60 caractères' using errcode = '22023'; end if;
  if length(v_last) not between 1 and 60 then raise exception 'Le nom doit contenir entre 1 et 60 caractères' using errcode = '22023'; end if;
  if length(v_bio) > 280 then raise exception 'La présentation ne doit pas dépasser 280 caractères' using errcode = '22023'; end if;

  update profiles set first_name = v_first, last_name = v_last, bio = v_bio
  where id = auth.uid() returning * into v_profile;
  return v_profile;
end $$;

create or replace function update_my_preferences(p_push boolean, p_messages boolean, p_email_reminders boolean)
  returns profiles language plpgsql security definer set search_path = public as $$
declare v_profile profiles;
begin
  if current_school_id() is null then raise exception 'Compte inactif' using errcode = '42501'; end if;
  update profiles set pref_push_enabled = p_push, pref_message_notifications = p_messages,
                      pref_email_reminders = p_email_reminders
  where id = auth.uid() returning * into v_profile;
  return v_profile;
end $$;

create or replace function complete_onboarding() returns void
  language sql security definer set search_path = public as $$
  update profiles set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = auth.uid() and status = 'active'
$$;

-- Organisations dont l'utilisateur est membre, avec ses permissions (pour l'espace de gestion).
create or replace function my_memberships()
  returns table (organization_id uuid, organization_name text, organization_type text, permissions text[])
  language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.type::text, coalesce(array_agg(mp.permission::text order by mp.permission)
                                             filter (where mp.permission is not null), '{}')
  from organization_members m
  join organizations o on o.id = m.organization_id and o.status = 'active'
  left join organization_member_permissions mp on mp.member_id = m.id
  where m.user_id = auth.uid() and o.school_id = current_school_id()
  group by o.id, o.name, o.type
  order by o.name
$$;

-- ================================================================ administration
-- Toutes les fonctions admin_* exigent un super-admin connecté avec son second facteur (aal2).
create or replace function assert_platform_admin() returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_platform_admin() then
    raise exception 'Réservé au super-administrateur' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Second facteur requis' using errcode = '42501';
  end if;
end $$;

create or replace function admin_create_school(p_name text, p_slug text, p_domains text[],
                                               p_timezone text default 'Europe/Paris')
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_domain text;
begin
  perform assert_platform_admin();
  if p_domains is null or array_length(p_domains, 1) is null then
    raise exception 'Au moins un domaine e-mail est requis' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Fuseau horaire inconnu : %', p_timezone using errcode = '22023';
  end if;

  insert into schools (name, slug, timezone) values (btrim(p_name), lower(btrim(p_slug)), p_timezone) returning id into v_id;
  foreach v_domain in array p_domains loop
    insert into school_domains (school_id, domain) values (v_id, lower(btrim(v_domain))) on conflict do nothing;
  end loop;
  insert into organizations (school_id, name, type, description)
  values (v_id, btrim(p_name), 'school', 'Communication officielle et modération.');

  perform write_audit(v_id, 'school.created', 'school', v_id::text,
                      jsonb_build_object('name', p_name, 'domains', p_domains));
  return v_id;
end $$;

create or replace function admin_set_school_status(p_school uuid, p_status school_status)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_platform_admin();
  update schools set status = p_status where id = p_school;
  if not found then raise exception 'École introuvable' using errcode = 'P0002'; end if;
  perform write_audit(p_school, 'school.status_changed', 'school', p_school::text, jsonb_build_object('status', p_status));
end $$;

create or replace function admin_create_organization(p_school uuid, p_name text, p_type org_type,
                                                     p_description text default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform assert_platform_admin();
  if p_type = 'school' then
    raise exception 'L''organisation École est créée automatiquement avec l''école' using errcode = '22023';
  end if;
  insert into organizations (school_id, name, type, description)
  values (p_school, btrim(p_name), p_type, nullif(btrim(coalesce(p_description, '')), ''))
  returning id into v_id;
  perform write_audit(p_school, 'organization.created', 'organization', v_id::text,
                      jsonb_build_object('name', p_name, 'type', p_type));
  return v_id;
end $$;

create or replace function admin_update_organization(p_org uuid, p_name text, p_description text, p_status org_status)
  returns void language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  perform assert_platform_admin();
  update organizations set name = btrim(p_name), description = nullif(btrim(coalesce(p_description, '')), ''),
                           status = p_status
  where id = p_org returning school_id into v_school;
  if not found then raise exception 'Organisation introuvable' using errcode = 'P0002'; end if;
  perform write_audit(v_school, 'organization.updated', 'organization', p_org::text,
                      jsonb_build_object('name', p_name, 'status', p_status));
end $$;

-- Remplace l'ensemble des permissions d'un membre (utilisé à l'ajout et à la modification).
create or replace function set_member_permissions_internal(p_member uuid, p_permissions org_permission[])
  returns void language plpgsql security definer set search_path = public as $$
begin
  delete from organization_member_permissions
  where member_id = p_member and not (permission = any (coalesce(p_permissions, '{}')));
  insert into organization_member_permissions (member_id, permission, granted_by)
  select p_member, unnest(coalesce(p_permissions, '{}')), auth.uid()
  on conflict do nothing;
end $$;
revoke all on function set_member_permissions_internal(uuid, org_permission[]) from public;

create or replace function admin_add_member(p_org uuid, p_email text, p_permissions org_permission[])
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org     organizations;
  v_user    uuid;
  v_member  uuid;
begin
  perform assert_platform_admin();
  select * into v_org from organizations where id = p_org;
  if not found then raise exception 'Organisation introuvable' using errcode = 'P0002'; end if;

  select id into v_user from profiles where email = normalize_email(p_email) and school_id = v_org.school_id;
  if v_user is null then
    raise exception 'Aucun compte pour cette adresse dans cette école : la personne doit s''être connectée une première fois'
      using errcode = 'P0002';
  end if;

  insert into organization_members (organization_id, school_id, user_id, added_by)
  values (p_org, v_org.school_id, v_user, auth.uid())
  on conflict (organization_id, user_id) do update set updated_by = auth.uid()
  returning id into v_member;

  perform set_member_permissions_internal(v_member, p_permissions);
  perform write_audit(v_org.school_id, 'organization.member_added', 'organization_member', v_member::text,
                      jsonb_build_object('organization_id', p_org, 'user_id', v_user, 'permissions', p_permissions));
  return v_member;
end $$;

create or replace function admin_set_member_permissions(p_member uuid, p_permissions org_permission[])
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_before org_permission[];
begin
  perform assert_platform_admin();
  select school_id into v_school from organization_members where id = p_member;
  if v_school is null then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  select coalesce(array_agg(permission order by permission), '{}') into v_before
  from organization_member_permissions where member_id = p_member;

  perform set_member_permissions_internal(p_member, p_permissions);
  update organization_members set updated_by = auth.uid() where id = p_member;
  perform write_audit(v_school, 'organization.member_permissions_changed', 'organization_member', p_member::text,
                      jsonb_build_object('before', v_before, 'after', p_permissions));
end $$;

create or replace function admin_remove_member(p_member uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_row organization_members;
begin
  perform assert_platform_admin();
  delete from organization_members where id = p_member returning * into v_row;
  if not found then raise exception 'Membre introuvable' using errcode = 'P0002'; end if;
  perform write_audit(v_row.school_id, 'organization.member_removed', 'organization_member', p_member::text,
                      jsonb_build_object('organization_id', v_row.organization_id, 'user_id', v_row.user_id));
end $$;

-- Désactivation / réactivation d'un compte. Le serveur révoque ensuite les sessions (Auth Admin API).
create or replace function admin_set_user_status(p_user uuid, p_status user_status)
  returns void language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  perform assert_platform_admin();
  update profiles set status = p_status where id = p_user returning school_id into v_school;
  if not found then raise exception 'Utilisateur introuvable' using errcode = 'P0002'; end if;
  perform write_audit(v_school, 'user.status_changed', 'user', p_user::text, jsonb_build_object('status', p_status));
end $$;

-- Import minimal (mode « ajouter ou mettre à jour ») ; le remplacement complet arrive en Phase 7.
-- p_rows : [{ "email", "person_type", "first_name", "last_name", "external_id", "cohort" }, ...]
create or replace function admin_import_allowed_emails(p_school uuid, p_rows jsonb, p_filename text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_batch    uuid;
  v_row      jsonb;
  v_email    text;
  v_type     person_type;
  v_inserted int := 0;
  v_updated  int := 0;
  v_rejected jsonb := '[]';
  v_xmax     xid;
  v_stats    jsonb;
begin
  perform assert_platform_admin();
  if not exists (select 1 from schools where id = p_school) then
    raise exception 'École introuvable' using errcode = 'P0002';
  end if;

  insert into import_batches (school_id, mode, filename, created_by)
  values (p_school, 'upsert', p_filename, auth.uid()) returning id into v_batch;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]')) loop
    v_email := normalize_email(v_row ->> 'email');
    if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
      v_rejected := v_rejected || jsonb_build_object('email', v_row ->> 'email', 'reason', 'Adresse invalide');
      continue;
    end if;
    if not exists (select 1 from school_domains where school_id = p_school and domain = split_part(v_email, '@', 2)) then
      v_rejected := v_rejected || jsonb_build_object('email', v_email, 'reason', 'Domaine non déclaré pour cette école');
      continue;
    end if;
    v_type := case lower(coalesce(v_row ->> 'person_type', 'student'))
                when 'personnel' then 'staff' when 'staff' then 'staff' else 'student' end;

    insert into allowed_emails (school_id, email, person_type, first_name, last_name, external_id, cohort, import_batch_id)
    values (p_school, v_email, v_type, nullif(btrim(v_row ->> 'first_name'), ''), nullif(btrim(v_row ->> 'last_name'), ''),
            nullif(btrim(v_row ->> 'external_id'), ''), nullif(btrim(v_row ->> 'cohort'), ''), v_batch)
    on conflict (school_id, email) do update
      set person_type = excluded.person_type,
          first_name = coalesce(excluded.first_name, allowed_emails.first_name),
          last_name = coalesce(excluded.last_name, allowed_emails.last_name),
          external_id = coalesce(excluded.external_id, allowed_emails.external_id),
          cohort = coalesce(excluded.cohort, allowed_emails.cohort),
          status = 'authorized', removed_at = null, import_batch_id = v_batch
    returning xmax into v_xmax;
    if v_xmax = 0 then v_inserted := v_inserted + 1; else v_updated := v_updated + 1; end if;
  end loop;

  v_stats := jsonb_build_object('inserted', v_inserted, 'updated', v_updated,
                                'rejected', jsonb_array_length(v_rejected), 'rejected_rows', v_rejected);
  update import_batches set stats = v_stats - 'rejected_rows' where id = v_batch;
  perform write_audit(p_school, 'allowed_emails.imported', 'import_batch', v_batch::text, v_stats - 'rejected_rows');
  return v_stats;
end $$;

-- Invitation du premier super-admin : exécutée par la commande d'installation (clé service_role).
create or replace function invite_platform_admin(p_email text) returns void
  language sql security definer set search_path = public as $$
  insert into platform_admin_invites (email) values (normalize_email(p_email)) on conflict do nothing
$$;

-- ================================================================ droits
revoke all on function login_precheck(text, text), hook_before_user_created(jsonb), invite_platform_admin(text),
  handle_new_auth_user(), sync_profile_authorization() from public, anon, authenticated;
grant execute on function login_precheck(text, text), invite_platform_admin(text) to service_role;
grant execute on function hook_before_user_created(jsonb) to supabase_auth_admin;

grant execute on function
  update_my_profile(text, text, text), update_my_preferences(boolean, boolean, boolean), complete_onboarding(),
  my_memberships(),
  admin_create_school(text, text, text[], text), admin_set_school_status(uuid, school_status),
  admin_create_organization(uuid, text, org_type, text), admin_update_organization(uuid, text, text, org_status),
  admin_add_member(uuid, text, org_permission[]), admin_set_member_permissions(uuid, org_permission[]),
  admin_remove_member(uuid), admin_set_user_status(uuid, user_status),
  admin_import_allowed_emails(uuid, jsonb, text)
to authenticated;

-- Le super-admin lit toutes les données utiles au back-office (écritures toujours via admin_*).
create policy admin_read_allowed_emails on allowed_emails for select to authenticated using (is_platform_admin());
create policy admin_read_import_batches on import_batches for select to authenticated using (is_platform_admin());
create policy admin_read_members on organization_members for select to authenticated
  using (is_platform_admin() or user_id = auth.uid());
drop policy members_read on organization_members;
create policy admin_read_domains on school_domains for select to authenticated
  using (is_platform_admin() or school_id = current_school_id());
grant select on allowed_emails, import_batches, school_domains to authenticated;
