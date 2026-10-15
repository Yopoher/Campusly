import type pg from "pg";

/**
 * Jeu de données fictif : deux campus partageant le domaine ynov.com.
 * Toutes les adresses sont inventées (*.test@ynov.com).
 */
export const ROUEN = "a0000000-0000-0000-0000-000000000000";
export const LYON = "b0000000-0000-0000-0000-000000000000";

export const ORG_ROUEN_SCHOOL = "a1000000-0000-0000-0000-000000000000";
export const ORG_ROUEN_BDE = "a2000000-0000-0000-0000-000000000000";
export const ORG_LYON_SCHOOL = "b1000000-0000-0000-0000-000000000000";

export const ALICE = "00000000-0000-0000-0000-000000000001"; // étudiante Rouen
export const BOB = "00000000-0000-0000-0000-000000000002"; // étudiant Rouen
export const CARLA = "00000000-0000-0000-0000-000000000003"; // membre du BDE Rouen
export const DAN = "00000000-0000-0000-0000-000000000004"; // personnel, modérateur Rouen
export const EVE = "00000000-0000-0000-0000-000000000005"; // étudiante Lyon

export const MEMBER_CARLA_BDE = "c0000000-0000-0000-0000-000000000003";
export const MEMBER_DAN_SCHOOL = "c0000000-0000-0000-0000-000000000004";

export const EVENT_ROUEN_PUBLISHED = "e1000000-0000-0000-0000-000000000000"; // capacité 1
export const EVENT_ROUEN_DRAFT = "e2000000-0000-0000-0000-000000000000";
export const EVENT_LYON = "e3000000-0000-0000-0000-000000000000";

type Person = { id: string; school: string; email: string; first: string; type: "student" | "staff" };

export const PEOPLE: Person[] = [
  { id: ALICE, school: ROUEN, email: "alice.test@ynov.com", first: "Alice", type: "student" },
  { id: BOB, school: ROUEN, email: "bob.test@ynov.com", first: "Bob", type: "student" },
  { id: CARLA, school: ROUEN, email: "carla.test@ynov.com", first: "Carla", type: "student" },
  { id: DAN, school: ROUEN, email: "dan.test@ynov.com", first: "Dan", type: "staff" },
  { id: EVE, school: LYON, email: "eve.test@ynov.com", first: "Eve", type: "student" },
];

/** Crée un utilisateur fictif (Auth + liste autorisée + profil). Exécuté en super-utilisateur. */
export async function createPerson(db: pg.Pool | pg.PoolClient, p: Person) {
  await db.query(
    `insert into allowed_emails (school_id, email, person_type) values ($1, $2, $3) on conflict do nothing`,
    [p.school, p.email, p.type],
  );
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [p.id, p.email]);
  await db.query(
    `insert into profiles (id, school_id, email, person_type, first_name, last_name) values ($1, $2, $3, $4, $5, 'Test')`,
    [p.id, p.school, p.email, p.type, p.first],
  );
}

export async function seedBaseline(db: pg.Pool) {
  await db.query(
    `insert into schools (id, name, slug) values ($1, 'Ynov Campus Rouen', 'ynov-rouen'), ($2, 'Ynov Campus Lyon', 'ynov-lyon')`,
    [ROUEN, LYON],
  );
  await db.query(`insert into school_domains values ($1, 'ynov.com'), ($2, 'ynov.com')`, [ROUEN, LYON]);
  for (const p of PEOPLE) await createPerson(db, p);

  await db.query(
    `insert into organizations (id, school_id, name, type) values
       ($1, $4, 'Ynov Rouen', 'school'), ($2, $4, 'BDE Rouen', 'bde'), ($3, $5, 'Ynov Lyon', 'school')`,
    [ORG_ROUEN_SCHOOL, ORG_ROUEN_BDE, ORG_LYON_SCHOOL, ROUEN, LYON],
  );
  await db.query(
    `insert into organization_members (id, organization_id, school_id, user_id) values
       ($1, $3, $5, $6), ($2, $4, $5, $7)`,
    [MEMBER_CARLA_BDE, MEMBER_DAN_SCHOOL, ORG_ROUEN_BDE, ORG_ROUEN_SCHOOL, ROUEN, CARLA, DAN],
  );
  await db.query(
    `insert into organization_member_permissions (member_id, permission) values
       ($1, 'events.create'), ($1, 'events.chat'),
       ($2, 'moderation.conversations'), ($2, 'moderation.reports')`,
    [MEMBER_CARLA_BDE, MEMBER_DAN_SCHOOL],
  );
  await db.query(
    `insert into events (id, school_id, organization_id, created_by, title, starts_at, location, capacity, status) values
       ($1, $4, $6, $8, 'Soirée intégration', now() + interval '3 days', 'Rouen', 1, 'published'),
       ($2, $4, $6, $8, 'Brouillon BDE',      now() + interval '9 days', 'Rouen', null, 'draft'),
       ($3, $5, $7, $9, 'Événement Lyon',     now() + interval '3 days', 'Lyon',  null, 'published')`,
    [EVENT_ROUEN_PUBLISHED, EVENT_ROUEN_DRAFT, EVENT_LYON, ROUEN, LYON, ORG_ROUEN_BDE, ORG_LYON_SCHOOL, CARLA, EVE],
  );
}
