import { afterAll, beforeAll, expect, it } from "vitest";
import { asUser, createTestDatabase, type TestDb } from "./support/database";
import { CARLA, ORG_ROUEN_BDE, ROUEN, createPerson, seedBaseline } from "./support/fixtures";

const WORKSHOP = "e4000000-0000-0000-0000-000000000000";
const STUDENTS = Array.from({ length: 20 }, (_, i) => ({
  id: `00000000-0000-0000-0000-0000000001${String(i).padStart(2, "0")}`,
  school: ROUEN,
  email: `etudiant${i}.test@ynov.com`,
  first: `Étudiant ${i}`,
  type: "student" as const,
}));

let db: TestDb;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedBaseline(db.pool);
  for (const s of STUDENTS) await createPerson(db.pool, s);
  await db.pool.query(
    `insert into events (id, school_id, organization_id, created_by, title, starts_at, location, capacity, status)
     values ($1, $2, $3, $4, 'Atelier 3 places', now() + interval '2 days', 'Rouen', 3, 'published')`,
    [WORKSHOP, ROUEN, ORG_ROUEN_BDE, CARLA],
  );
});
afterAll(async () => {
  await db?.drop();
});

it("20 inscriptions simultanées sur 3 places : exactement 3 acceptées, compteur exact", async () => {
  const results = await Promise.allSettled(
    STUDENTS.map((s) => asUser(db.pool, s.id, (c) => c.query("select register_for_event($1)", [WORKSHOP]))),
  );
  const accepted = results.filter((r) => r.status === "fulfilled").length;
  const refusedFull = results.filter(
    (r) => r.status === "rejected" && (r.reason as Error).message === "Événement complet",
  ).length;

  expect(accepted).toBe(3);
  expect(refusedFull).toBe(17);

  const { rows } = await db.pool.query(
    `select e.participants_count as counter,
            (select count(*)::int from registrations r where r.event_id = e.id and r.status = 'registered') as real
     from events e where e.id = $1`,
    [WORKSHOP],
  );
  expect(rows[0]).toEqual({ counter: 3, real: 3 });
});
