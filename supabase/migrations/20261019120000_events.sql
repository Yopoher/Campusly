-- Phase 4 : événements (création, modification, publication, annulation) et lectures.
-- Règles : cahier des charges §8 à §10. Toutes les écritures passent par une fonction SECURITY DEFINER
-- qui vérifie identité, école, statut et permission, puis écrit l'audit (CLAUDE.md).
-- Les lectures passent par une vue en security_invoker : elle applique les politiques RLS de l'appelant.

-- ---------------------------------------------------------------- vérifications communes
create or replace function assert_event_permission(p_org uuid, p_perm org_permission)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if current_school_id() is null then raise exception 'Compte inactif' using errcode = '42501'; end if;
  if not has_org_permission(p_org, p_perm) then
    raise exception 'Permission insuffisante pour cette organisation' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------- vue de lecture
-- Une ligne par événement, enrichie de l'organisation et des droits de l'appelant.
-- security_invoker : la vue ne contourne jamais les politiques RLS de events, organizations et registrations.
create or replace view event_cards with (security_invoker = true) as
select
  e.id,
  e.school_id,
  e.organization_id,
  e.title,
  e.description,
  e.starts_at,
  e.ends_at,
  e.location,
  e.image_path,
  e.capacity,
  e.participants_count,
  e.registration_deadline,
  e.external_url,
  e.status,
  e.published_at,
  e.cancelled_at,
  e.cancellation_reason,
  o.name                                  as organization_name,
  o.type::text                            as organization_type,
  o.description                           as organization_description,
  coalesce(e.ends_at, e.starts_at) < now() as is_past,
  exists (select 1 from registrations r
          where r.event_id = e.id and r.user_id = auth.uid() and r.status = 'registered') as registered,
  (    e.status = 'published' and now() < e.starts_at
   and (e.registration_deadline is null or now() <= e.registration_deadline)
   and (e.capacity is null or e.participants_count < e.capacity)) as registration_open,
  is_org_member(e.organization_id)                             as is_org_member,
  has_org_permission(e.organization_id, 'events.create')       as can_publish,
  has_org_permission(e.organization_id, 'events.edit')         as can_edit,
  has_org_permission(e.organization_id, 'events.cancel')       as can_cancel
from events e
join organizations o on o.id = e.organization_id;

-- ---------------------------------------------------------------- création et modification
create or replace function create_event(
  p_org uuid, p_title text, p_description text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_location text, p_capacity integer, p_registration_deadline timestamptz, p_external_url text,
  p_publish boolean)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_event  uuid;
begin
  perform assert_event_permission(p_org, 'events.create');
  if p_starts_at <= now() then
    raise exception 'La date de début doit être dans le futur' using errcode = '22023';
  end if;
  select school_id into v_school from organizations where id = p_org;

  insert into events (school_id, organization_id, created_by, updated_by, title, description, starts_at, ends_at,
                      location, capacity, registration_deadline, external_url, status, published_at)
  values (v_school, p_org, auth.uid(), auth.uid(), btrim(p_title), coalesce(btrim(p_description), ''),
          p_starts_at, p_ends_at, btrim(p_location), p_capacity, p_registration_deadline,
          nullif(btrim(coalesce(p_external_url, '')), ''),
          case when p_publish then 'published' else 'draft' end::event_status,
          case when p_publish then now() end)
  returning id into v_event;

  perform write_audit(v_school, 'event.created', 'event', v_event::text,
                      jsonb_build_object('organization', p_org, 'published', p_publish));
  return v_event;
end $$;

create or replace function update_event(
  p_event uuid, p_title text, p_description text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_location text, p_capacity integer, p_registration_deadline timestamptz, p_external_url text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_event events;
  v_major boolean;
begin
  select * into v_event from events where id = p_event for update;
  if not found then raise exception 'Événement introuvable' using errcode = 'P0002'; end if;
  perform assert_event_permission(v_event.organization_id, 'events.edit');

  if v_event.status = 'cancelled' then
    raise exception 'Un événement annulé ne peut plus être modifié' using errcode = 'P0001';
  end if;
  if p_starts_at is distinct from v_event.starts_at and p_starts_at <= now() then
    raise exception 'La date de début doit être dans le futur' using errcode = '22023';
  end if;
  if p_capacity is not null and p_capacity < v_event.participants_count then
    raise exception 'Il y a déjà % inscrit·e·s : la capacité ne peut pas descendre en dessous', v_event.participants_count
      using errcode = '22023';
  end if;

  -- Changement de date, d'heure ou de lieu : les inscrits doivent être prévenus (notifications, Phase 6).
  v_major := p_starts_at is distinct from v_event.starts_at or p_ends_at is distinct from v_event.ends_at
          or btrim(p_location) is distinct from v_event.location;

  update events set
    title = btrim(p_title),
    description = coalesce(btrim(p_description), ''),
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    location = btrim(p_location),
    capacity = p_capacity,
    registration_deadline = p_registration_deadline,
    external_url = nullif(btrim(coalesce(p_external_url, '')), ''),
    updated_by = auth.uid()
  where id = p_event;

  perform write_audit(v_event.school_id, 'event.updated', 'event', p_event::text,
                      jsonb_build_object('major', v_major));
end $$;

-- ---------------------------------------------------------------- publication et annulation
create or replace function publish_event(p_event uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_event events;
begin
  select * into v_event from events where id = p_event for update;
  if not found then raise exception 'Événement introuvable' using errcode = 'P0002'; end if;
  perform assert_event_permission(v_event.organization_id, 'events.create');

  if v_event.status <> 'draft' then
    raise exception 'Seul un brouillon peut être publié' using errcode = 'P0001';
  end if;
  if v_event.starts_at <= now() then
    raise exception 'La date de début doit être dans le futur' using errcode = '22023';
  end if;

  update events set status = 'published', published_at = now(), updated_by = auth.uid() where id = p_event;
  perform write_audit(v_event.school_id, 'event.published', 'event', p_event::text, '{}');
end $$;

create or replace function cancel_event(p_event uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
declare v_event events;
begin
  select * into v_event from events where id = p_event for update;
  if not found then raise exception 'Événement introuvable' using errcode = 'P0002'; end if;
  perform assert_event_permission(v_event.organization_id, 'events.cancel');

  if v_event.status <> 'published' then
    raise exception 'Seul un événement publié peut être annulé' using errcode = 'P0001';
  end if;

  -- L'annulation ne supprime rien : inscriptions et conversation sont conservées (§8.2).
  -- Les rappels planifiés et l'e-mail d'annulation sont gérés en Phase 6.
  update events set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = nullif(btrim(coalesce(p_reason, '')), ''),
    updated_by = auth.uid()
  where id = p_event;
  perform write_audit(v_event.school_id, 'event.cancelled', 'event', p_event::text, '{}');
end $$;

-- ---------------------------------------------------------------- lectures
-- Parcours du fil : 'upcoming' (à venir), 'mine' (inscrit, à venir), 'past' (passés), 'organization' (profil).
-- Les brouillons n'apparaissent jamais ici ; ils sont réservés à la gestion (list_managed_events).
create or replace function list_events(p_scope text, p_org uuid default null)
  returns setof event_cards language plpgsql stable set search_path = public as $$
begin
  if current_school_id() is null then raise exception 'Compte inactif' using errcode = '42501'; end if;

  -- RETURN QUERY ne quitte pas la fonction : chaque branche se termine par RETURN.
  if p_scope = 'upcoming' then
    return query select * from event_cards c where c.status <> 'draft' and not c.is_past order by c.starts_at;
    return;
  elsif p_scope = 'mine' then
    return query select * from event_cards c
                 where c.status <> 'draft' and not c.is_past and c.registered order by c.starts_at;
    return;
  elsif p_scope = 'past' then
    return query select * from event_cards c where c.status <> 'draft' and c.is_past order by c.starts_at desc;
    return;
  elsif p_scope = 'organization' and p_org is not null then
    return query select * from event_cards c
                 where c.status <> 'draft' and not c.is_past and c.organization_id = p_org order by c.starts_at;
    return;
  end if;
  raise exception 'Parcours inconnu' using errcode = '22023';
end $$;

-- Tous les événements d'une organisation, brouillons compris (tableau de bord de gestion).
create or replace function list_managed_events(p_org uuid)
  returns setof event_cards language plpgsql stable set search_path = public as $$
begin
  if not is_org_member(p_org) then raise exception 'Permission insuffisante pour cette organisation' using errcode = '42501'; end if;
  return query select * from event_cards c where c.organization_id = p_org order by c.starts_at desc;
end $$;

create or replace function get_event(p_event uuid) returns event_cards
  language plpgsql stable set search_path = public as $$
declare v_card event_cards;
begin
  select * into v_card from event_cards where id = p_event;
  if not found then raise exception 'Événement introuvable' using errcode = 'P0002'; end if;
  return v_card;
end $$;

-- Liste des inscrits : visible par toute l'école pour un événement publié (décision v1.1), jamais l'e-mail.
create or replace function list_event_participants(p_event uuid)
  returns table (user_id uuid, first_name text, last_name text, avatar_path text, bio text, registered_at timestamptz)
  language plpgsql stable set search_path = public as $$
begin
  if not exists (select 1 from event_cards c where c.id = p_event) then
    raise exception 'Événement introuvable' using errcode = 'P0002';
  end if;
  return query
    select r.user_id, p.first_name, p.last_name, p.avatar_path, p.bio, r.registered_at
    from registrations r
    join profiles p on p.id = r.user_id
    where r.event_id = p_event and r.status = 'registered'
    order by r.registered_at, p.first_name;
end $$;

create or replace function get_organization(p_org uuid)
  returns table (id uuid, name text, type text, description text)
  language sql stable set search_path = public as $$
  select o.id, o.name, o.type::text, o.description
  from organizations o
  where o.id = p_org and o.status = 'active' and o.school_id = current_school_id()
$$;

-- ---------------------------------------------------------------- droits
-- Les fonctions du module ne sont appelables que par un utilisateur connecté (défaut : aucun droit).
revoke all on table event_cards from public, anon, authenticated;
grant select on table event_cards to authenticated;

revoke all on function
  assert_event_permission(uuid, org_permission),
  create_event(uuid, text, text, timestamptz, timestamptz, text, integer, timestamptz, text, boolean),
  update_event(uuid, text, text, timestamptz, timestamptz, text, integer, timestamptz, text),
  publish_event(uuid), cancel_event(uuid, text),
  list_events(text, uuid), list_managed_events(uuid), get_event(uuid), list_event_participants(uuid),
  get_organization(uuid)
from public, anon;

grant execute on function
  create_event(uuid, text, text, timestamptz, timestamptz, text, integer, timestamptz, text, boolean),
  update_event(uuid, text, text, timestamptz, timestamptz, text, integer, timestamptz, text),
  publish_event(uuid), cancel_event(uuid, text),
  list_events(text, uuid), list_managed_events(uuid), get_event(uuid), list_event_participants(uuid),
  get_organization(uuid)
to authenticated;

-- assert_event_permission n'est appelée que depuis les fonctions ci-dessus (exécutées par leur propriétaire).
revoke all on function assert_event_permission(uuid, org_permission) from authenticated;
