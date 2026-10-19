-- Phase 5 : conversations et modération (docs/PRODUCT_SPEC.md §11).
-- Les tables messages et message_reports existent depuis 20261015120000_init.sql.
-- Cette migration ajoute les fonctions métier manquantes, toutes SECURITY DEFINER + audit.

-- ================================================================ signalement
create or replace function report_message(p_message_id bigint, p_reason text default null)
  returns message_reports
  language plpgsql security definer set search_path = public as $$
declare
  v_msg    messages;
  v_report message_reports;
begin
  select * into v_msg from messages where id = p_message_id;
  if not found then raise exception 'Message introuvable' using errcode = 'P0002'; end if;

  -- L'auteur ne peut pas signaler son propre message
  if v_msg.author_id = auth.uid() then
    raise exception 'Tu ne peux pas signaler ton propre message' using errcode = 'P0001';
  end if;

  -- Il faut avoir accès à la conversation
  if not can_access_conversation(v_msg.event_id) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  insert into message_reports (school_id, message_id, reporter_id, reason)
  values (v_msg.school_id, p_message_id, auth.uid(), btrim(p_reason))
  on conflict (message_id, reporter_id) do nothing
  returning * into v_report;

  -- Si déjà signalé par cet utilisateur, on renvoie le signalement existant
  if v_report is null then
    select * into v_report from message_reports
    where message_id = p_message_id and reporter_id = auth.uid();
  else
    perform write_audit(v_msg.school_id, 'message.reported', 'message', p_message_id::text,
                        jsonb_build_object('event_id', v_msg.event_id));
  end if;

  return v_report;
end $$;

-- ================================================================ masquage (modération)
create or replace function hide_message(p_message_id bigint)
  returns messages
  language plpgsql security definer set search_path = public as $$
declare
  v_msg messages;
begin
  select * into v_msg from messages where id = p_message_id for update;
  if not found then raise exception 'Message introuvable' using errcode = 'P0002'; end if;

  -- Seul un modérateur de l'école peut masquer
  if not is_school_moderator(v_msg.school_id) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  -- Vérifier la permission moderation.conversations
  if not has_org_permission(
    (select o.id from organizations o where o.school_id = v_msg.school_id and o.type = 'school'),
    'moderation.conversations'
  ) then
    raise exception 'Permission manquante' using errcode = '42501';
  end if;

  update messages set moderation_status = 'hidden', moderated_by = auth.uid(), moderated_at = now()
  where id = p_message_id
  returning * into v_msg;

  perform write_audit(v_msg.school_id, 'message.hidden', 'message', p_message_id::text,
                      jsonb_build_object('event_id', v_msg.event_id, 'author_id', v_msg.author_id));
  return v_msg;
end $$;

-- ================================================================ traitement d'un signalement
create or replace function handle_report(p_report_id uuid, p_action report_status)
  returns message_reports
  language plpgsql security definer set search_path = public as $$
declare
  v_report message_reports;
begin
  if p_action not in ('resolved', 'dismissed') then
    raise exception 'Action invalide : resolved ou dismissed' using errcode = '22023';
  end if;

  select * into v_report from message_reports where id = p_report_id for update;
  if not found then raise exception 'Signalement introuvable' using errcode = 'P0002'; end if;

  -- Seul un modérateur avec moderation.reports peut traiter
  if not is_school_moderator(v_report.school_id) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if not has_org_permission(
    (select o.id from organizations o where o.school_id = v_report.school_id and o.type = 'school'),
    'moderation.reports'
  ) then
    raise exception 'Permission manquante' using errcode = '42501';
  end if;

  update message_reports set status = p_action, handled_by = auth.uid(), handled_at = now()
  where id = p_report_id
  returning * into v_report;

  perform write_audit(v_report.school_id, 'report.' || p_action::text, 'report', p_report_id::text,
                      jsonb_build_object('message_id', v_report.message_id));
  return v_report;
end $$;

-- ================================================================ suspension de chat
create or replace function suspend_chat_user(p_user_id uuid, p_until timestamptz)
  returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
  v_target_school uuid;
begin
  v_school := current_school_id();
  if v_school is null then raise exception 'Compte inactif' using errcode = '42501'; end if;

  -- Le modérateur doit avoir la permission moderation.suspend_chat
  if not has_org_permission(
    (select o.id from organizations o where o.school_id = v_school and o.type = 'school'),
    'moderation.suspend_chat'
  ) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  -- La cible doit appartenir à la même école
  select school_id into v_target_school from profiles where id = p_user_id;
  if v_target_school is null or v_target_school <> v_school then
    raise exception 'Utilisateur introuvable dans cette école' using errcode = 'P0002';
  end if;

  -- On ne suspend pas un modérateur
  if is_school_moderator(v_school) then
    -- Vérifier si la CIBLE est modérateur (pas l'appelant)
    if exists (
      select 1 from organization_members m
      join organizations o on o.id = m.organization_id
      where o.school_id = v_school and o.type = 'school' and m.user_id = p_user_id
    ) then
      raise exception 'Impossible de suspendre un membre de l''organisation École' using errcode = 'P0001';
    end if;
  end if;

  update profiles set chat_suspended_until = p_until where id = p_user_id;

  perform write_audit(v_school, 'chat.suspended', 'profile', p_user_id::text,
                      jsonb_build_object('until', p_until));
end $$;

-- ================================================================ lever la suspension
create or replace function unsuspend_chat_user(p_user_id uuid)
  returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_school uuid;
begin
  v_school := current_school_id();
  if v_school is null then raise exception 'Compte inactif' using errcode = '42501'; end if;

  if not has_org_permission(
    (select o.id from organizations o where o.school_id = v_school and o.type = 'school'),
    'moderation.suspend_chat'
  ) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  update profiles set chat_suspended_until = null where id = p_user_id and school_id = v_school;

  perform write_audit(v_school, 'chat.unsuspended', 'profile', p_user_id::text, '{}');
end $$;

-- ================================================================ droits
revoke all on function report_message(bigint, text) from public, anon;
grant execute on function report_message(bigint, text) to authenticated;

revoke all on function hide_message(bigint) from public, anon;
grant execute on function hide_message(bigint) to authenticated;

revoke all on function handle_report(uuid, report_status) from public, anon;
grant execute on function handle_report(uuid, report_status) to authenticated;

revoke all on function suspend_chat_user(uuid, timestamptz) from public, anon;
grant execute on function suspend_chat_user(uuid, timestamptz) to authenticated;

revoke all on function unsuspend_chat_user(uuid) from public, anon;
grant execute on function unsuspend_chat_user(uuid) to authenticated;

-- ================================================================ politique d'insertion des signalements
-- Le RLS insert passe par la fonction SECURITY DEFINER, mais si quelqu'un
-- essaie un INSERT direct, la politique le bloque.
create policy reports_insert on message_reports for insert to authenticated
  with check (reporter_id = auth.uid());
