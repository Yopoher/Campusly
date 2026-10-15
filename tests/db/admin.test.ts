import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, expectSqlError, type TestDb } from "./support/database";
import { ALICE, BOB, ORG_ROUEN_BDE, ROUEN, seedBaseline } from "./support/fixtures";

/** Fonctions d'administration (cahier des charges §3.5, §15, tests 20.7). */
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

describe("Accès aux fonctions d'administration", () => {
  it("refusé à un utilisateur ordinaire, même avec un second facteur", async () => {
    const err = await expectSqlError(
      asUser(db.pool, ALICE, (c) => c.query("select admin_create_school('X', 'x', array['x.fr'])"), { aal: "aal2" }),
    );
    expect(err.message).toBe("Réservé au super-administrateur");
  });

  it("refusé au super-admin sans second facteur", async () => {
    const err = await expectSqlError(
      asUser(db.pool, ADMIN, (c) => c.query("select admin_create_school('X', 'x', array['x.fr'])"), { aal: "aal1" }),
    );
    expect(err.message).toBe("Second facteur requis");
  });

  it("un utilisateur ne peut pas modifier ses propres permissions", async () => {
    const err = await expectSqlError(
      asUser(db.pool, ALICE, (c) =>
        c.query("insert into organization_members (organization_id, school_id, user_id) values ($1, $2, $3)", [
          ORG_ROUEN_BDE,
          ROUEN,
          ALICE,
        ]),
      ),
    );
    expect(err.code).toBe("42501");
  });
});

describe("Écoles et organisations", () => {
  let school: string;

  it("crée une école, ses domaines et son organisation École", async () => {
    school = await asAdmin(
      async (c) =>
        (await c.query("select admin_create_school('Ynov Campus Caen', 'ynov-caen', array['YNOV.com']) as id")).rows[0]
          .id,
    );
    const { rows } = await db.pool.query(
      `select (select domain from school_domains where school_id = $1) as domain,
              (select type from organizations where school_id = $1) as org_type`,
      [school],
    );
    expect(rows[0]).toEqual({ domain: "ynov.com", org_type: "school" });
  });

  it("refuse un fuseau horaire inconnu et une école sans domaine", async () => {
    expect(
      (
        await expectSqlError(
          asAdmin((c) => c.query("select admin_create_school('Y', 'y', array['y.fr'], 'Mars/Olympus')")),
        )
      ).message,
    ).toMatch(/Fuseau horaire inconnu/);
    expect(
      (await expectSqlError(asAdmin((c) => c.query("select admin_create_school('Y', 'y', array[]::text[])")))).message,
    ).toMatch(/domaine/);
  });

  it("crée une association, mais pas une seconde organisation École", async () => {
    const id = await asAdmin(
      async (c) =>
        (await c.query("select admin_create_organization($1, 'Ynov Gaming', 'association') as id", [ROUEN])).rows[0].id,
    );
    expect(id).toBeTruthy();
    const err = await expectSqlError(
      asAdmin((c) => c.query("select admin_create_organization($1, 'Bis', 'school')", [ROUEN])),
    );
    expect(err.message).toMatch(/créée automatiquement/);
  });

  it("journalise les actions d'administration", async () => {
    const { rows } = await db.pool.query("select action from audit_logs where actor_id = $1 order by id", [ADMIN]);
    expect(rows.map((r) => r.action)).toEqual(["school.created", "organization.created"]);
  });
});

describe("Membres et permissions", () => {
  let member: string;

  it("ajoute un membre existant de l'école avec ses permissions", async () => {
    member = await asAdmin(
      async (c) =>
        (
          await c.query(
            "select admin_add_member($1, 'BOB.test@ynov.com', array['events.create','events.chat']::org_permission[]) as id",
            [ORG_ROUEN_BDE],
          )
        ).rows[0].id,
    );
    const perms = await asUser(db.pool, BOB, async (c) => (await c.query("select * from my_memberships()")).rows);
    expect(perms).toEqual([
      {
        organization_id: ORG_ROUEN_BDE,
        organization_name: "BDE Rouen",
        organization_type: "bde",
        permissions: ["events.create", "events.chat"],
      },
    ]);
  });

  it("refuse une personne qui ne s'est jamais connectée", async () => {
    const err = await expectSqlError(
      asAdmin((c) => c.query("select admin_add_member($1, 'inconnu@ynov.com', '{}')", [ORG_ROUEN_BDE])),
    );
    expect(err.message).toMatch(/connectée une première fois/);
  });

  it("refuse une permission de modération dans une organisation autre que l'École", async () => {
    const err = await expectSqlError(
      asAdmin((c) =>
        c.query("select admin_set_member_permissions($1, array['moderation.reports']::org_permission[])", [member]),
      ),
    );
    expect(err.message).toMatch(/réservées à l'organisation École/);
  });

  it("remplace les permissions et garde la trace de l'avant/après", async () => {
    await asAdmin((c) =>
      c.query("select admin_set_member_permissions($1, array['events.chat']::org_permission[])", [member]),
    );
    const { rows } = await db.pool.query(
      "select metadata from audit_logs where action = 'organization.member_permissions_changed' order by id desc limit 1",
    );
    expect(rows[0].metadata).toEqual({ before: ["events.create", "events.chat"], after: ["events.chat"] });
  });

  it("le retrait d'un membre supprime ses droits immédiatement", async () => {
    await asAdmin((c) => c.query("select admin_remove_member($1)", [member]));
    const perms = await asUser(db.pool, BOB, async (c) => (await c.query("select * from my_memberships()")).rows);
    expect(perms).toEqual([]);
  });
});

describe("Comptes et import", () => {
  it("désactive un compte, qui perd l'accès", async () => {
    await asAdmin((c) => c.query("select admin_set_user_status($1, 'deactivated')", [BOB]));
    const n = await asUser(db.pool, BOB, async (c) =>
      Number((await c.query("select count(*) from events")).rows[0].count),
    );
    expect(n).toBe(0);
    await asAdmin((c) => c.query("select admin_set_user_status($1, 'active')", [BOB]));
  });

  it("importe une liste : ajoute, met à jour, rejette les lignes invalides ou d'un autre domaine", async () => {
    const rows = [
      { email: " Nouveau.Test@ynov.com ", first_name: "Nina", person_type: "personnel" },
      { email: "bob.test@ynov.com", cohort: "B3" },
      { email: "pas-une-adresse" },
      { email: "quelqu.un@gmail.com" },
    ];
    const stats = await asAdmin(
      async (c) =>
        (
          await c.query("select admin_import_allowed_emails($1, $2::jsonb, 'liste.csv') as s", [
            ROUEN,
            JSON.stringify(rows),
          ])
        ).rows[0].s,
    );
    expect([stats.inserted, stats.updated, stats.rejected]).toEqual([1, 1, 2]);
    expect(stats.rejected_rows.map((r: { reason: string }) => r.reason)).toEqual([
      "Adresse invalide",
      "Domaine non déclaré pour cette école",
    ]);
    const { rows: n } = await db.pool.query(
      "select person_type, first_name from allowed_emails where email = 'nouveau.test@ynov.com'",
    );
    expect(n[0]).toEqual({ person_type: "staff", first_name: "Nina" });
  });

  it("le super-admin lit la liste autorisée, pas un utilisateur ordinaire", async () => {
    const admin = await asAdmin(async (c) =>
      Number((await c.query("select count(*) from allowed_emails")).rows[0].count),
    );
    const user = await asUser(db.pool, ALICE, async (c) =>
      Number((await c.query("select count(*) from allowed_emails")).rows[0].count),
    );
    expect(admin).toBeGreaterThan(0);
    expect(user).toBe(0);
  });
});
