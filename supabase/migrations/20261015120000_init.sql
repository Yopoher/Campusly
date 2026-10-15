-- Campusly — migration initiale
-- Schéma, fonctions d'autorisation, fonctions métier transactionnelles et politiques RLS.
-- Suppose le schéma `auth` de Supabase (auth.users, auth.uid()) et les rôles anon / authenticated / service_role.
-- Documentation : docs/DATABASE.md et docs/SECURITY.md. Tests : tests/db/.

-- Toute nouvelle table est fermée par défaut aux rôles client : chaque migration doit
-- ouvrir explicitement ce qui doit l'être, avec ses politiques RLS et ses tests.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ---------------------------------------------------------------- types
create type school_status       as enum ('active', 'disabled');
create type person_type         as enum ('student', 'staff');
create type allowed_status      as enum ('authorized', 'removed');
create type import_mode         as enum ('upsert', 'replace');
create type user_status         as enum ('active', 'deactivated', 'unauthorized');
create type org_type            as enum ('school', 'direction', 'pedagogy', 'bde', 'association', 'other');
create type org_status          as enum ('active', 'disabled');
create type org_permission      as enum (
  'events.create', 'events.edit', 'events.cancel', 'events.view_participants', 'events.chat',
  'communications.send_all',
  'moderation.conversations', 'moderation.reports', 'moderation.suspend_chat');
create type event_status        as enum ('draft', 'published', 'cancelled');
create type registration_status as enum ('registered', 'unregistered');
create type moderation_status   as enum ('visible', 'hidden');
create type report_status       as enum ('pending', 'resolved', 'dismissed');
create type notification_type   as enum (
  'event_reminder_24h', 'event_reminder_1h', 'event_updated', 'event_cancelled',
  'new_messages', 'communication', 'new_report');
create type delivery_status     as enum ('not_applicable', 'pending', 'sent', 'failed', 'skipped', 'cancelled');
create type push_platform       as enum ('ios', 'android', 'desktop', 'other');
create type subscription_status as enum ('active', 'invalid', 'revoked');

-- ---------------------------------------------------------------- utilitaires
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------- écoles
create table schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 2 and 120),
  slug       text not null unique check (slug ~ '^[a-z0-9-]+$'),
  timezone   text not null default 'Europe/Paris',
  status     school_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table school_domains (
  school_id uuid not null references schools on delete cascade,
  domain    text not null check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  primary key (school_id, domain)
);
create index on school_domains (domain);

-- ---------------------------------------------------------------- adresses autorisées
create table import_batches (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references schools,
  mode       import_mode not null,
  filename   text,
  stats      jsonb not null default '{}',
  created_by uuid not null references auth.users,
  created_at timestamptz not null default now()
);

create table allowed_emails (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools,
  email           text not null check (email = lower(btrim(email)) and email like '%_@_%.__%'),
  person_type     person_type not null default 'student',
  first_name      text,
  last_name       text,
  external_id     text,
  cohort          text,
  status          allowed_status not null default 'authorized',
  import_batch_id uuid references import_batches,
  removed_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (school_id, email)
);
create index on allowed_emails (email);

-- ---------------------------------------------------------------- comptes
create table profiles (
  id                         uuid primary key references auth.users on delete cascade,
  school_id                  uuid not null references schools,
  email                      text not null unique,
  person_type                person_type not null default 'student',
  first_name                 text not null default '' check (length(first_name) <= 60),
  last_name                  text not null default '' check (length(last_name) <= 60),
  avatar_path                text,
  bio                        text check (length(bio) <= 280),
  status                     user_status not null default 'active',
  chat_suspended_until       timestamptz,
  onboarding_completed_at    timestamptz,
  pref_push_enabled          boolean not null default true,
  pref_message_notifications boolean not null default true,
  pref_email_reminders       boolean not null default true,
  anonymized_at              timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index on profiles (school_id);

create table platform_admins (
  user_id    uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- organisations
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools,
  name        text not null check (length(name) between 2 and 80),
  type        org_type not null,
  logo_path   text,
  description text check (length(description) <= 500),
  status      org_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, school_id)
);
create unique index one_school_org_per_school on organizations (school_id) where type = 'school';

create table organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  school_id       uuid not null,
  user_id         uuid not null references profiles on delete cascade,
  added_by        uuid references auth.users,
  updated_by      uuid references auth.users,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id),
  foreign key (organization_id, school_id) references organizations (id, school_id) on delete cascade
);
create index on organization_members (user_id);

create table organization_member_permissions (
  member_id  uuid not null references organization_members on delete cascade,
  permission org_permission not null,
  granted_by uuid references auth.users,
  granted_at timestamptz not null default now(),
  primary key (member_id, permission)
);

-- les permissions de modération n'existent que dans l'organisation « école »
create or replace function check_moderation_permission() returns trigger language plpgsql as $$
begin
  if new.permission::text like 'moderation.%' and not exists (
       select 1 from organization_members m join organizations o on o.id = m.organization_id
       where m.id = new.member_id and o.type = 'school') then
    raise exception 'Les permissions de modération sont réservées à l''organisation École';
  end if;
  return new;
end $$;
create trigger trg_check_moderation_permission before insert or update on organization_member_permissions
  for each row execute function check_moderation_permission();

-- le membre doit appartenir à la même école que l'organisation
create or replace function check_member_school() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from profiles p where p.id = new.user_id and p.school_id = new.school_id) then
    raise exception 'Le membre doit appartenir à l''école de l''organisation';
  end if;
  return new;
end $$;
create trigger trg_check_member_school before insert or update on organization_members
  for each row execute function check_member_school();

-- ---------------------------------------------------------------- événements
create table events (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null,
  organization_id       uuid not null,
  created_by            uuid not null references auth.users,
  updated_by            uuid references auth.users,
  title                 text not null check (length(title) between 3 and 120),
  description           text not null default '' check (length(description) <= 5000),
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  location              text not null check (length(location) between 2 and 200),
  image_path            text,
  capacity              integer check (capacity > 0),
  registration_deadline timestamptz,
  external_url          text check (external_url ~ '^https://'),
  status                event_status not null default 'draft',
  published_at          timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text check (length(cancellation_reason) <= 500),
  participants_count    integer not null default 0 check (participants_count >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (organization_id, school_id) references organizations (id, school_id),
  check (ends_at is null or ends_at > starts_at),
  check (registration_deadline is null or registration_deadline <= starts_at),
  check (capacity is null or participants_count <= capacity)
);
create index on events (school_id, status, starts_at);
create index on events (organization_id);

create table registrations (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events,
  user_id         uuid not null references profiles,
  school_id       uuid not null references schools,
  status          registration_status not null default 'registered',
  registered_at   timestamptz not null default now(),
  unregistered_at timestamptz,
  chat_muted      boolean not null default false,
  unique (event_id, user_id)
);
create index on registrations (user_id, status);

-- ---------------------------------------------------------------- conversations
create table messages (
  id                bigint generated always as identity primary key,
  event_id          uuid not null references events,
  school_id         uuid not null references schools,
  author_id         uuid not null references profiles,
  organization_id   uuid references organizations,
  body              text not null check (length(btrim(body)) between 1 and 2000),
  moderation_status moderation_status not null default 'visible',
  moderated_by      uuid references auth.users,
  moderated_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index on messages (event_id, id desc);

create table message_reports (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools,
  message_id  bigint not null references messages,
  reporter_id uuid not null references profiles,
  reason      text check (length(reason) <= 500),
  status      report_status not null default 'pending',
  handled_by  uuid references auth.users,
  handled_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (message_id, reporter_id)
);
create index on message_reports (school_id, status);

-- ---------------------------------------------------------------- communications
create table communications (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null,
  organization_id  uuid not null,
  author_id        uuid not null references profiles,
  title            text not null check (length(title) between 3 and 120),
  body             text not null check (length(body) between 1 and 2000),
  event_id         uuid references events,
  target           text not null default 'school' check (target = 'school'),
  recipients_count integer not null default 0,
  created_at       timestamptz not null default now(),
  foreign key (organization_id, school_id) references organizations (id, school_id)
);

-- ---------------------------------------------------------------- notifications
create table notifications (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references schools,
  user_id          uuid not null references profiles on delete cascade,
  type             notification_type not null,
  title            text not null,
  body             text not null,
  url              text,
  event_id         uuid references events,
  communication_id uuid references communications,
  scheduled_at     timestamptz not null default now(),
  dedupe_key       text not null unique,
  push_status      delivery_status not null default 'pending',
  email_status     delivery_status not null default 'not_applicable',
  attempts         integer not null default 0,
  next_attempt_at  timestamptz not null default now(),
  last_error       text,
  sent_at          timestamptz,
  read_at          timestamptz,
  opened_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index notifications_due on notifications (next_attempt_at)
  where push_status = 'pending' or email_status = 'pending';
create index on notifications (user_id, created_at desc);

create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles on delete cascade,
  endpoint        text not null unique check (endpoint ~ '^https://'),
  p256dh          text not null,
  auth            text not null,
  platform        push_platform not null default 'other',
  is_standalone   boolean not null default false,
  user_agent      text,
  status          subscription_status not null default 'active',
  last_success_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on push_subscriptions (user_id) where status = 'active';

create table message_notification_state (
  event_id         uuid not null references events,
  user_id          uuid not null references profiles on delete cascade,
  last_notified_at timestamptz not null,
  primary key (event_id, user_id)
);

-- ---------------------------------------------------------------- suivi, audit, réglages
create table analytics_events (
  id         bigint generated always as identity primary key,
  school_id  uuid references schools,
  user_id    uuid references profiles on delete set null,
  type       text not null check (type in ('event_view', 'onboarding_shown', 'pwa_installed',
                                           'push_granted', 'push_denied', 'notification_opened', 'session_start')),
  platform   push_platform,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on analytics_events (school_id, type, created_at);

create table audit_logs (
  id          bigint generated always as identity primary key,
  school_id   uuid references schools,
  actor_id    uuid references auth.users on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on audit_logs (school_id, created_at desc);

create table platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into platform_settings (key, value) values
  ('communications_per_org_per_week', '3'),
  ('message_notification_window_minutes', '10'),
  ('reminder_offsets_hours', '[24, 1]');

create table login_attempts (
  id         bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash    text,
  created_at timestamptz not null default now()
);
create index on login_attempts (email_hash, created_at);
create index on login_attempts (ip_hash, created_at);

-- triggers updated_at
do $$ declare t text; begin
  foreach t in array array['schools','allowed_emails','profiles','organizations','organization_members','events','push_subscriptions']
  loop execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ================================================================ fonctions d'autorisation
create or replace function is_platform_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid())
$$;

-- école de l'utilisateur courant, seulement si le compte est actif
create or replace function current_school_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select p.school_id from profiles p join schools s on s.id = p.school_id
  where p.id = auth.uid() and p.status = 'active' and s.status = 'active'
$$;

create or replace function has_org_permission(p_org uuid, p_perm org_permission) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members m
    join organization_member_permissions mp on mp.member_id = m.id
    join organizations o on o.id = m.organization_id
    where m.organization_id = p_org and m.user_id = auth.uid()
      and mp.permission = p_perm and o.status = 'active'
      and o.school_id = current_school_id())
$$;

create or replace function is_school_moderator(p_school uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_school = current_school_id() and exists (
    select 1 from organizations o
    where o.school_id = p_school and o.type = 'school'
      and has_org_permission(o.id, 'moderation.conversations'))
$$;

create or replace function is_org_member(p_org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members m join organizations o on o.id = m.organization_id
                 where m.organization_id = p_org and m.user_id = auth.uid()
                   and o.school_id = current_school_id())
$$;

create or replace function can_access_conversation(p_event uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.id = p_event and e.school_id = current_school_id() and e.status <> 'draft'
      and (   exists (select 1 from registrations r where r.event_id = e.id and r.user_id = auth.uid() and r.status = 'registered')
           or has_org_permission(e.organization_id, 'events.chat')
           or is_school_moderator(e.school_id)))
$$;

-- vérification avant envoi d'un code de connexion (appelée par le serveur et par le hook Auth)
create or replace function can_request_login(p_email text) returns boolean
  language sql stable security definer set search_path = public as $$
  with e as (select lower(btrim(p_email)) as email)
  select exists (
    select 1 from e
    join allowed_emails a on a.email = e.email and a.status = 'authorized'
    join schools s on s.id = a.school_id and s.status = 'active'
    join school_domains d on d.school_id = s.id and d.domain = split_part(e.email, '@', 2)
    where not exists (select 1 from profiles p where p.email = e.email and p.status <> 'active'))
$$;

-- ================================================================ audit
create or replace function write_audit(p_school uuid, p_action text, p_type text, p_id text, p_meta jsonb default '{}')
  returns void language sql security definer set search_path = public as $$
  insert into audit_logs (school_id, actor_id, action, target_type, target_id, metadata)
  values (p_school, auth.uid(), p_action, p_type, p_id, coalesce(p_meta, '{}'))
$$;

-- ================================================================ inscriptions (transactionnelles)
create or replace function register_for_event(p_event uuid) returns events
  language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := current_school_id();
  v_event  events;
  v_reg    registrations;
begin
  if v_school is null then raise exception 'Compte inactif' using errcode = '42501'; end if;

  select * into v_event from events where id = p_event for update;   -- sérialise les inscriptions sur cet événement
  if not found or v_event.school_id <> v_school or v_event.status <> 'published' then
    raise exception 'Événement introuvable' using errcode = 'P0002';
  end if;
  if now() >= v_event.starts_at or (v_event.registration_deadline is not null and now() > v_event.registration_deadline) then
    raise exception 'Les inscriptions sont fermées' using errcode = 'P0001';
  end if;

  select * into v_reg from registrations where event_id = p_event and user_id = auth.uid();
  if found and v_reg.status = 'registered' then
    return v_event;                                                   -- idempotent : double clic sans effet
  end if;
  if v_event.capacity is not null and v_event.participants_count >= v_event.capacity then
    raise exception 'Événement complet' using errcode = 'P0001';
  end if;

  insert into registrations (event_id, user_id, school_id)
  values (p_event, auth.uid(), v_school)
  on conflict (event_id, user_id) do update
    set status = 'registered', registered_at = now(), unregistered_at = null;

  update events set participants_count = participants_count + 1 where id = p_event returning * into v_event;
  -- Phase 6 : planification des rappels (insert dans notifications)
  return v_event;
end $$;

create or replace function unregister_from_event(p_event uuid) returns events
  language plpgsql security definer set search_path = public as $$
declare v_event events;
begin
  select * into v_event from events where id = p_event and school_id = current_school_id() for update;
  if not found then raise exception 'Événement introuvable' using errcode = 'P0002'; end if;

  update registrations set status = 'unregistered', unregistered_at = now()
  where event_id = p_event and user_id = auth.uid() and status = 'registered';
  if found then
    update events set participants_count = participants_count - 1 where id = p_event returning * into v_event;
    update notifications set push_status = 'cancelled', email_status = case when email_status = 'pending' then 'cancelled'::delivery_status else email_status end
    where event_id = p_event and user_id = auth.uid() and type in ('event_reminder_24h', 'event_reminder_1h') and push_status = 'pending';
  end if;
  return v_event;
end $$;

-- ================================================================ messages
create or replace function post_message(p_event uuid, p_body text, p_as_org uuid default null) returns messages
  language plpgsql security definer set search_path = public as $$
declare
  v_msg messages;
  v_event events;
  v_suspended timestamptz;
begin
  if not can_access_conversation(p_event) then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select * into v_event from events where id = p_event;
  if v_event.status = 'cancelled' then raise exception 'Conversation en lecture seule' using errcode = 'P0001'; end if;
  select chat_suspended_until into v_suspended from profiles where id = auth.uid();
  if v_suspended is not null and v_suspended > now() then raise exception 'Écriture suspendue' using errcode = '42501'; end if;
  if p_as_org is not null and (p_as_org <> v_event.organization_id or not has_org_permission(p_as_org, 'events.chat')) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  insert into messages (event_id, school_id, author_id, organization_id, body)
  values (p_event, v_event.school_id, auth.uid(), p_as_org, btrim(p_body))
  returning * into v_msg;
  -- Phase 6 : notifications regroupées via message_notification_state
  return v_msg;
end $$;

-- ================================================================ RLS
alter table schools                         enable row level security;
alter table school_domains                  enable row level security;
alter table import_batches                  enable row level security;
alter table allowed_emails                  enable row level security;
alter table profiles                        enable row level security;
alter table platform_admins                 enable row level security;
alter table organizations                   enable row level security;
alter table organization_members            enable row level security;
alter table organization_member_permissions enable row level security;
alter table events                          enable row level security;
alter table registrations                   enable row level security;
alter table messages                        enable row level security;
alter table message_reports                 enable row level security;
alter table communications                  enable row level security;
alter table notifications                   enable row level security;
alter table push_subscriptions              enable row level security;
alter table message_notification_state      enable row level security;
alter table analytics_events                enable row level security;
alter table audit_logs                      enable row level security;
alter table platform_settings               enable row level security;
alter table login_attempts                  enable row level security;
-- Sans politique, une table RLS est fermée : allowed_emails, import_batches, platform_admins,
-- message_notification_state, login_attempts, platform_settings ne sont accessibles qu'au serveur.

-- écoles : sa propre école ; super-admin : toutes
create policy schools_read on schools for select to authenticated
  using (id = current_school_id() or is_platform_admin());

-- profils : membres de la même école (champs publics via la vue public_profiles) ; écriture via update_my_profile
create policy profiles_read on profiles for select to authenticated
  using (school_id = current_school_id() or is_platform_admin());

-- organisations et membres : lisibles dans l'école
create policy organizations_read on organizations for select to authenticated
  using ((school_id = current_school_id() and status = 'active') or is_platform_admin());
create policy members_read on organization_members for select to authenticated
  using (user_id = auth.uid() or is_platform_admin());
create policy member_permissions_read on organization_member_permissions for select to authenticated
  using (exists (select 1 from organization_members m where m.id = member_id and m.user_id = auth.uid()) or is_platform_admin());

-- événements : publiés et annulés de l'école ; brouillons pour les membres de l'organisation
create policy events_read on events for select to authenticated
  using (is_platform_admin() or (school_id = current_school_id()
         and (status <> 'draft' or is_org_member(organization_id))));

-- inscriptions : visibles dans l'école pour les événements publiés (liste des participants)
create policy registrations_read on registrations for select to authenticated
  using (is_platform_admin() or (school_id = current_school_id() and exists (
         select 1 from events e where e.id = event_id and e.status <> 'draft')));

-- messages : uniquement si accès à la conversation
create policy messages_read on messages for select to authenticated
  using (can_access_conversation(event_id));

-- signalements : leur auteur et les modérateurs de l'école
create policy reports_read on message_reports for select to authenticated
  using (reporter_id = auth.uid() or (is_school_moderator(school_id)
         and has_org_permission((select o.id from organizations o where o.school_id = message_reports.school_id and o.type = 'school'), 'moderation.reports')));

-- communications : lisibles dans l'école
create policy communications_read on communications for select to authenticated
  using (school_id = current_school_id() or is_platform_admin());

-- notifications : uniquement les siennes ; seule la date de lecture est modifiable
create policy notifications_read on notifications for select to authenticated
  using (user_id = auth.uid());

-- abonnements push : uniquement les siens
create policy push_read on push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_delete on push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- audit : super-admin uniquement
create policy audit_read on audit_logs for select to authenticated using (is_platform_admin());

-- Aucune politique INSERT/UPDATE/DELETE directe sur les tables métier : toutes les écritures passent
-- par les fonctions SECURITY DEFINER ci-dessus (et celles des phases suivantes).
revoke all on all tables in schema public from anon;
revoke insert, update, delete on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
grant delete on push_subscriptions to authenticated;

-- profils : seuls les champs publics sont lisibles par les autres utilisateurs (jamais l'e-mail).
-- Son propre profil complet se lit via get_my_profile().
revoke select on profiles from authenticated;
grant select (id, school_id, first_name, last_name, avatar_path, bio) on profiles to authenticated;

create or replace function get_my_profile() returns profiles
  language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid()
$$;

revoke all on all functions in schema public from public, anon;
grant execute on function
  is_platform_admin(), current_school_id(), has_org_permission(uuid, org_permission),
  is_school_moderator(uuid), is_org_member(uuid), can_access_conversation(uuid),
  get_my_profile(), register_for_event(uuid), unregister_from_event(uuid),
  post_message(uuid, text, uuid)
to authenticated;
grant execute on function can_request_login(text) to service_role;
