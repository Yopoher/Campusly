import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, expectSqlError, type TestDb } from "./support/database";
import { CARLA, ORG_ROUEN_BDE, ROUEN, seedBaseline } from "./support/fixtures";

/** Modification des écoles et des organisations par le super-administrateur. */
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

const domainsOf = async (school: string) =>
  (await db.pool.query("select domain from school_domains where school_id = $1", [school])).rows
    .map((r) => r.domain as string)
    .sort();

describe("Modification d'une école", () => {
  it("modifie le nom et le fuseau horaire", async () => {
    await asAdmin((c) =>
      c.query("select admin_update_school($1, 'Ynov Rouen Campus', 'Europe/Paris', array['ynov.com'])", [ROUEN]),
    );
    const row = (await db.pool.query("select name, timezone from schools where id = $1", [ROUEN])).rows[0];
    expect(row).toEqual({ name: "Ynov Rouen Campus", timezone: "Europe/Paris" });
  });

  it("ajoute un domaine", async () => {
    await asAdmin((c) =>
      c.query(
        "select admin_update_school($1, 'Ynov Rouen Campus', 'Europe/Paris', array['ynov.com', 'ynov-rouen.fr'])",
        [ROUEN],
      ),
    );
    expect(await domainsOf(ROUEN)).toEqual(["ynov-rouen.fr", "ynov.com"]);
  });

  it("retire un domaine inutilisé", async () => {
    await asAdmin((c) =>
      c.query("select admin_update_school($1, 'Ynov Rouen Campus', 'Europe/Paris', array['ynov.com'])", [ROUEN]),
    );
    expect(await domainsOf(ROUEN)).toEqual(["ynov.com"]);
  });

  it("refuse de retirer un domaine encore utilisé par une adresse autorisée", async () => {
    const err = await expectSqlError(
      asAdmin((c) =>
        c.query("select admin_update_school($1, 'Ynov Rouen Campus', 'Europe/Paris', array['autre.fr'])", [ROUEN]),
      ),
    );
    expect(err.code).toBe("22023");
    expect(await domainsOf(ROUEN)).toEqual(["ynov.com"]);
  });

  it("refuse un fuseau horaire inconnu, une liste de domaines vide ou un domaine mal formé", async () => {
    for (const args of [
      ["Ynov", "Mars/Olympus", "array['ynov.com']"],
      ["Ynov", "Europe/Paris", "array[]::text[]"],
      ["Ynov", "Europe/Paris", "array['pas un domaine']"],
      ["X", "Europe/Paris", "array['ynov.com']"],
    ]) {
      const err = await expectSqlError(
        asAdmin((c) => c.query(`select admin_update_school($1, $2, $3, ${args[2]})`, [ROUEN, args[0], args[1]])),
      );
      expect(err.code).toBe("22023");
    }
  });

  it("réservé au super-administrateur", async () => {
    const err = await expectSqlError(
      asUser(db.pool, CARLA, (c) =>
        c.query("select admin_update_school($1, 'Piraterie', 'Europe/Paris', array['ynov.com'])", [ROUEN]),
      ),
    );
    expect(err.code).toBe("42501");
  });
});

describe("Modification d'une organisation et désactivation", () => {
  it("renomme une organisation et la désactive sans la supprimer", async () => {
    await asAdmin((c) =>
      c.query("select admin_update_organization($1, 'BDE renommé', 'Nouvelle description', 'disabled')", [
        ORG_ROUEN_BDE,
      ]),
    );
    const row = (await db.pool.query("select name, status from organizations where id = $1", [ORG_ROUEN_BDE])).rows[0];
    expect(row).toEqual({ name: "BDE renommé", status: "disabled" });
  });

  it("désactive une école sans la supprimer", async () => {
    await asAdmin((c) => c.query("select admin_set_school_status($1, 'disabled')", [ROUEN]));
    expect((await db.pool.query("select status from schools where id = $1", [ROUEN])).rows[0].status).toBe("disabled");
  });
});
