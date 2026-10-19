import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, asUser, createTestDatabase, expectSqlError, type TestDb } from "./support/database";
import { BOB, CARLA, LYON, ROUEN, seedBaseline } from "./support/fixtures";

/** Remplacement d'une liste d'étudiants : retrait des adresses absentes du nouveau fichier. */
let db: TestDb;
const ADMIN = "00000000-0000-0000-0000-0000000000ad";

beforeAll(async () => {
  db = await createTestDatabase();
  await seedBaseline(db.pool);
  await db.pool.query("insert into auth.users (id, email) values ($1, 'admin.test@gmail.com')", [ADMIN]);
  await db.pool.query("insert into platform_admins (user_id) values ($1)", [ADMIN]);
});
afterAll(async () => {
  await db?.drop();
});

const asAdmin = <T>(fn: Parameters<typeof asUser<T>>[2]) => asUser(db.pool, ADMIN, fn, { aal: "aal2" });
const status = async (email: string, school: string) =>
  (await db.pool.query("select status from allowed_emails where email = $1 and school_id = $2", [email, school]))
    .rows[0]?.status;

const precheck = (email: string) =>
  asRole(
    db.pool,
    "service_role",
    async (c) => (await c.query("select login_precheck($1, null) as r", [email])).rows[0].r,
  );

describe("Remplacement de la liste", () => {
  it("retire seulement les adresses absentes du fichier, et renvoie leur liste", async () => {
    const removed = await asAdmin((c) =>
      c.query("select admin_remove_allowed_emails($1, $2) as r", [
        ROUEN,
        ["alice.test@ynov.com", "carla.test@ynov.com"],
      ]),
    );
    expect(removed.rows[0].r).toEqual(["bob.test@ynov.com", "dan.test@ynov.com"]);
    expect(await status("alice.test@ynov.com", ROUEN)).toBe("authorized");
    expect(await status("bob.test@ynov.com", ROUEN)).toBe("removed");
  });

  it("le compte d'une adresse retirée est désactivé et ne peut plus demander de code", async () => {
    const profile = await db.pool.query("select status from profiles where id = $1", [BOB]);
    expect(profile.rows[0].status).toBe("unauthorized");
    expect(await precheck("bob.test@ynov.com")).toBe("denied");
  });

  it("ne touche pas aux autres écoles", async () => {
    expect(await status("eve.test@ynov.com", LYON)).toBe("authorized");
  });

  it("refuse une liste vide, qui viderait la liste actuelle", async () => {
    const err = await expectSqlError(
      asAdmin((c) => c.query("select admin_remove_allowed_emails($1, $2)", [ROUEN, []])),
    );
    expect(err.code).toBe("22023");
    expect(await status("alice.test@ynov.com", ROUEN)).toBe("authorized");
  });

  it("réservé au super-administrateur avec second facteur", async () => {
    const err = await expectSqlError(
      asUser(db.pool, CARLA, (c) =>
        c.query("select admin_remove_allowed_emails($1, $2)", [ROUEN, ["x.test@ynov.com"]]),
      ),
    );
    expect(err.code).toBe("42501");
    const noMfa = await expectSqlError(
      asUser(
        db.pool,
        ADMIN,
        (c) => c.query("select admin_remove_allowed_emails($1, $2)", [ROUEN, ["x.test@ynov.com"]]),
        {
          aal: "aal1",
        },
      ),
    );
    expect(noMfa.code).toBe("42501");
  });

  it("journalise le retrait", async () => {
    const audit = await db.pool.query("select 1 from audit_logs where action = 'allowed_emails.removed'");
    expect(audit.rowCount).toBeGreaterThan(0);
  });
});
