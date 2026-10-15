-- Données FICTIVES pour le développement local et la préproduction.
-- Ne jamais exécuter en production. Aucune adresse réelle : uniquement *.test@ynov.com.
-- Les comptes Auth sont créés à la première connexion (Phase 3) ; ce fichier prépare
-- l'école, ses domaines, la liste autorisée et les organisations.

insert into schools (id, name, slug, timezone) values
  ('a0000000-0000-0000-0000-000000000000', 'Ynov Campus Rouen (démo)', 'ynov-rouen-demo', 'Europe/Paris');

insert into school_domains (school_id, domain) values
  ('a0000000-0000-0000-0000-000000000000', 'ynov.com');

insert into allowed_emails (school_id, email, person_type, first_name, last_name, cohort) values
  ('a0000000-0000-0000-0000-000000000000', 'alice.test@ynov.com',  'student', 'Alice',  'Martin',  'B1'),
  ('a0000000-0000-0000-0000-000000000000', 'bob.test@ynov.com',    'student', 'Bob',    'Durand',  'B2'),
  ('a0000000-0000-0000-0000-000000000000', 'carla.test@ynov.com',  'student', 'Carla',  'Leroy',   'B3'),
  ('a0000000-0000-0000-0000-000000000000', 'dan.test@ynov.com',    'staff',   'Dan',    'Moreau',  null),
  ('a0000000-0000-0000-0000-000000000000', 'admin.test@ynov.com',  'staff',   'Admin',  'Campusly', null);

insert into organizations (id, school_id, name, type, description) values
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'Ynov Campus Rouen', 'school', 'Communication officielle et modération du campus.'),
  ('a2000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'BDE Ynov Rouen', 'bde', 'Soirées, intégration et vie étudiante.'),
  ('a3000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'Pédagogie', 'pedagogy', 'Job datings, conférences, rencontres professionnelles.');
