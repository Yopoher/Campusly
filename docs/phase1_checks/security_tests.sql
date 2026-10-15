\set ON_ERROR_STOP 1
-- ---------- données fictives
insert into schools (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000000', 'Ynov Campus Rouen', 'ynov-rouen'),
  ('b0000000-0000-0000-0000-000000000000', 'Ynov Campus Lyon',  'ynov-lyon');
insert into school_domains values ('a0000000-0000-0000-0000-000000000000', 'ynov.com'), ('b0000000-0000-0000-0000-000000000000', 'ynov.com');
insert into allowed_emails (school_id, email, person_type) values
  ('a0000000-0000-0000-0000-000000000000', 'alice.test@ynov.com', 'student'),
  ('a0000000-0000-0000-0000-000000000000', 'bob.test@ynov.com',   'student'),
  ('a0000000-0000-0000-0000-000000000000', 'carla.test@ynov.com', 'student'),
  ('a0000000-0000-0000-0000-000000000000', 'dan.test@ynov.com',   'staff'),
  ('b0000000-0000-0000-0000-000000000000', 'eve.test@ynov.com',   'student');
insert into auth.users values
  ('00000000-0000-0000-0000-000000000001', 'alice.test@ynov.com'),
  ('00000000-0000-0000-0000-000000000002', 'bob.test@ynov.com'),
  ('00000000-0000-0000-0000-000000000003', 'carla.test@ynov.com'),
  ('00000000-0000-0000-0000-000000000004', 'dan.test@ynov.com'),
  ('00000000-0000-0000-0000-000000000005', 'eve.test@ynov.com');
insert into profiles (id, school_id, email, first_name, last_name) values
  ('00000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', 'alice.test@ynov.com', 'Alice', 'T'),
  ('00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000000', 'bob.test@ynov.com',   'Bob',   'T'),
  ('00000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000000', 'carla.test@ynov.com', 'Carla', 'T'),
  ('00000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000000', 'dan.test@ynov.com',   'Dan',   'T'),
  ('00000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000', 'eve.test@ynov.com',   'Eve',   'T');
insert into organizations (id, school_id, name, type) values
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'Ynov Rouen', 'school'),
  ('a2000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'BDE Rouen',  'bde'),
  ('b1000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Ynov Lyon',  'school');
insert into organization_members (id, organization_id, school_id, user_id) values
  ('c0000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004');
insert into organization_member_permissions (member_id, permission) values
  ('c0000000-0000-0000-0000-000000000003', 'events.create'), ('c0000000-0000-0000-0000-000000000003', 'events.chat'),
  ('c0000000-0000-0000-0000-000000000004', 'moderation.conversations'), ('c0000000-0000-0000-0000-000000000004', 'moderation.reports');
insert into events (id, school_id, organization_id, created_by, title, starts_at, location, capacity, status) values
  ('e1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'Soirée intégration', now() + interval '3 days', 'Rouen', 1, 'published'),
  ('e2000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'Brouillon BDE',      now() + interval '9 days', 'Rouen', null, 'draft'),
  ('e3000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005', 'Événement Lyon',     now() + interval '3 days', 'Lyon',  null, 'published');

-- ---------- T1 : moderation.* refusé hors organisation École
do $$ begin
  begin
    insert into organization_member_permissions values ('c0000000-0000-0000-0000-000000000003', 'moderation.reports');
    raise exception 'ECHEC T1';
  exception when raise_exception then
    if sqlerrm = 'ECHEC T1' then raise; end if;
  end;
  raise notice 'OK T1 modération réservée à l''organisation École';
end $$;

-- ---------- T2 : can_request_login (domaine partagé, liste par campus)
do $$ begin
  assert can_request_login(' Alice.Test@YNOV.com '), 'T2a';
  assert not can_request_login('inconnu@ynov.com'), 'T2b';
  assert not can_request_login('alice.test@gmail.com'), 'T2c';
  raise notice 'OK T2 contrôle de connexion (normalisation, liste, domaine)';
end $$;

-- ---------- en tant qu'Alice (étudiante Rouen)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;
do $$ begin
  assert (select count(*) from events) = 1, 'T3 Alice doit voir 1 événement (pas le brouillon, pas Lyon)';
  assert not exists (select 1 from events where id = 'e3000000-0000-0000-0000-000000000000'), 'T3b';
  raise notice 'OK T3 isolation inter-écoles et brouillons invisibles';
end $$;
do $$ begin
  begin perform email from profiles; raise exception 'ECHEC T4';
  exception when insufficient_privilege then raise notice 'OK T4 e-mails des autres utilisateurs non lisibles'; end;
end $$;
do $$ begin
  begin insert into events (school_id, organization_id, created_by, title, starts_at, location)
        values ('a0000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000000', auth.uid(), 'Pirate', now() + interval '1 day', 'X');
        raise exception 'ECHEC T5';
  exception when insufficient_privilege then raise notice 'OK T5 écriture directe interdite'; end;
end $$;
do $$ begin
  begin perform post_message('e1000000-0000-0000-0000-000000000000', 'salut'); raise exception 'ECHEC T6';
  exception when insufficient_privilege then raise notice 'OK T6 non-inscrit : envoi de message refusé'; end;
end $$;
do $$ begin
  begin perform register_for_event('e3000000-0000-0000-0000-000000000000'); raise exception 'ECHEC T7';
  exception when no_data_found then raise notice 'OK T7 inscription à un événement d''une autre école refusée'; end;
end $$;
select (register_for_event('e1000000-0000-0000-0000-000000000000')).participants_count as "Alice inscrite, compteur";
select (register_for_event('e1000000-0000-0000-0000-000000000000')).participants_count as "Double clic, compteur inchangé";
select (post_message('e1000000-0000-0000-0000-000000000000', 'Hâte d''y être')).id is not null as "Alice inscrite : message envoyé";
reset role;

-- ---------- Bob : événement complet (capacité 1)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
do $$ begin
  begin perform register_for_event('e1000000-0000-0000-0000-000000000000'); raise exception 'ECHEC T8';
  exception when raise_exception then
    if sqlerrm <> 'Événement complet' then raise; end if;
    raise notice 'OK T8 capacité respectée';
  end;
  assert (select count(*) from messages) = 0, 'T9 Bob ne doit lire aucun message';
  raise notice 'OK T9 non-inscrit : lecture des messages impossible';
  assert (select count(*) from registrations) = 1, 'T10 liste des participants visible dans l''école';
  raise notice 'OK T10 participants visibles par l''école';
end $$;
reset role;

-- ---------- Carla (BDE, events.chat) et Dan (modérateur École)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
set role authenticated;
do $$ begin
  assert (select count(*) from events) = 2, 'T11 membre BDE voit son brouillon';
  assert (select count(*) from messages) = 1, 'T12 organisateur lit la conversation';
  perform post_message('e1000000-0000-0000-0000-000000000000', 'Bienvenue !', 'a2000000-0000-0000-0000-000000000000');
  raise notice 'OK T11-T12 organisatrice : brouillon visible, message sous profil BDE';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
set role authenticated;
do $$ begin
  assert (select count(*) from messages) = 2, 'T13 modérateur lit toutes les conversations de l''école';
  raise notice 'OK T13 modération École : lecture sans inscription';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
set role authenticated;
do $$ begin
  assert (select count(*) from messages) = 0 and (select count(*) from registrations) = 0, 'T14';
  raise notice 'OK T14 étudiante de Lyon : aucun message ni participant de Rouen';
end $$;
reset role;

-- ---------- compte désactivé
update profiles set status = 'deactivated' where id = '00000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;
do $$ begin
  assert (select count(*) from events) = 0 and (select count(*) from messages) = 0, 'T15';
  raise notice 'OK T15 compte désactivé : plus aucun accès, même avec une session valide';
end $$;
reset role;
do $$ begin assert not can_request_login('alice.test@ynov.com'), 'T16'; raise notice 'OK T16 compte désactivé : plus de code envoyé'; end $$;
