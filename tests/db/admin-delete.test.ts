import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, expectSqlError, type TestDb } from "./support/database";
import { CARLA, ORG_ROUEN_BDE, ORG_ROUEN_SCHOOL, ROUEN, seedBaseline } from "./support/fixtures";

/** Suppression : seulement pour les organisations et écoles vides. */
let db: TestDb;
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
const asAdmin = <T>(fn: Parameters<typeof asUser<T>>[2]) => asUser(db.pool, ADMIN, fn, { aal: "aal2" });

beforeAll(async () => {
  db = await createTestDatabase();
  await seedBaseline(db.pool);
  await db.pool.query("insert into auth.users (id, email) values ($1, 'admin.test@gmail.com')", [ADMIN]);
  await db.pool.query("insert into platform_admins (user_id) values ($1)", [ADMIN]);
});
afterAll(async () => {
  await db?.drop();
});

describe("Suppression d'une organisation", () => {
  it("refuse de supprimer l'organisation École", async () => {
    const err = await expectSqlError(
      asAdmin((c) => c.query("select admin_delete_organization($1)", [ORG_ROUEN_SCHOOL])),
    );
    expect(err.code).toBe("22023");
  });

  it("refuse de supprimer une organisation qui a des événements", async () => {
    const err = await expectSqlError(asAdmin((c) => c.query("select admin_delete_organization($1)", [ORG_ROUEN_BDE])));
    expect(err.code).toBe("22023");
    expect((await db.pool.query("select 1 from organizations where id = $1", [ORG_ROUEN_BDE])).rowCount).toBe(1);
  });

  it("supprime une organisation vide et garde la trace dans le journal", async () => {
    const id = (
      await asAdmin((c) => c.query("select admin_create_organization($1, 'Club vide', 'association') as id", [ROUEN]))
    ).rows[0].id;
    await asAdmin((c) => c.query("select admin_delete_organization($1)", [id]));
    expect((await db.pool.query("select 1 from organizations where id = $1", [id])).rowCount).toBe(0);
    const audit = await db.pool.query(
      "select 1 from audit_logs where action = 'organization.deleted' and target_id = $1",
      [id],
    );
    expect(audit.rowCount).toBe(1);
  });

  it("réservé au super-administrateur", async () => {
    const err = await expectSqlError(
      asUser(db.pool, CARLA, (c) => c.query("select admin_delete_organization($1)", [ORG_ROUEN_BDE])),
    );
    expect(err.code).toBe("42501");
  });
});

describe("Suppression d'une école", () => {
  it("refuse de supprimer une école qui contient des personnes", async () => {
    const err = await expectSqlError(asAdmin((c) => c.query("select admin_delete_school($1)", [ROUEN])));
    expect(err.code).toBe("22023");
    expect((await db.pool.query("select 1 from schools where id = $1", [ROUEN])).rowCount).toBe(1);
  });

  it("supprime une école vide, avec son école-organisation et ses domaines, et garde la trace", async () => {
    const school = (
      await asAdmin((c) => c.query("select admin_create_school('Campus vide', 'campus-vide', array['vide.fr']) as id"))
    ).rows[0].id;
    await asAdmin((c) => c.query("select admin_delete_school($1)", [school]));
    expect((await db.pool.query("select 1 from schools where id = $1", [school])).rowCount).toBe(0);
    expect((await db.pool.query("select 1 from organizations where school_id = $1", [school])).rowCount).toBe(0);
    expect((await db.pool.query("select 1 from school_domains where school_id = $1", [school])).rowCount).toBe(0);
    const audit = await db.pool.query(
      "select school_id from audit_logs where action = 'school.deleted' and target_id = $1",
      [school],
    );
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].school_id).toBeNull();
  });
});
