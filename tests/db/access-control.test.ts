import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, expectSqlError, type TestDb } from "./support/database";
import {
  ALICE,
  BOB,
  CARLA,
  DAN,
  EVE,
  EVENT_LYON,
  EVENT_ROUEN_DRAFT,
  EVENT_ROUEN_PUBLISHED,
  MEMBER_CARLA_BDE,
  ORG_ROUEN_BDE,
  ROUEN,
  seedBaseline,
} from "./support/fixtures";

/**
 * Contrôles d'accès (cahier des charges §4, §5, §10, §11, §20).
 * Les tests s'enchaînent dans l'ordre : Alice s'inscrit puis écrit,
 * ce qui conditionne les vérifications suivantes.
 */
let db: TestDb;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedBaseline(db.pool);
});
afterAll(async () => {
  await db?.drop();
});

const count = async (c: { query: (q: string) => Promise<{ rows: { n: string }[] }> }, table: string) =>
  Number((await c.query(`select count(*) as n from ${table}`)).rows[0].n);

describe("Organisations et permissions", () => {
  it("refuse une permission de modération hors de l'organisation École", async () => {
    const err = await expectSqlError(
      db.pool.query(`insert into organization_member_permissions values ($1, 'moderation.reports')`, [
        MEMBER_CARLA_BDE,
      ]),
    );
    expect(err.message).toMatch(/réservées à l'organisation École/);
  });
});

describe("Contrôle avant envoi d'un code de connexion", () => {
  const canLogin = async (email: string) =>
    (await db.pool.query("select can_request_login($1) as ok", [email])).rows[0].ok as boolean;

  it("accepte une adresse autorisée, quelle que soit sa casse ou ses espaces", async () => {
    expect(await canLogin(" Alice.Test@YNOV.com ")).toBe(true);
  });
  it("refuse une adresse du bon domaine absente de la liste", async () => {
    expect(await canLogin("inconnu@ynov.com")).toBe(false);
  });
  it("refuse une adresse d'un autre domaine", async () => {
    expect(await canLogin("alice.test@gmail.com")).toBe(false);
  });
  it("n'est pas appelable par un utilisateur connecté (réservé au serveur)", async () => {
    const err = await expectSqlError(asUser(db.pool, ALICE, (c) => c.query("select can_request_login('x@ynov.com')")));
    expect(err.code).toBe("42501");
  });
});

describe("Isolation et visibilité", () => {
  it("un étudiant ne voit ni les brouillons ni les événements d'un autre campus", async () => {
    const ids = await asUser(db.pool, ALICE, async (c) =>
      (await c.query("select id from events")).rows.map((r) => r.id),
    );
    expect(ids).toEqual([EVENT_ROUEN_PUBLISHED]);
    expect(ids).not.toContain(EVENT_ROUEN_DRAFT);
    expect(ids).not.toContain(EVENT_LYON);
  });

  it("les adresses e-mail des autres utilisateurs ne sont pas lisibles", async () => {
    const err = await expectSqlError(asUser(db.pool, ALICE, (c) => c.query("select email from profiles")));
    expect(err.code).toBe("42501");
  });

  it("les champs publics des profils de l'école sont lisibles, pas ceux d'un autre campus", async () => {
    const names = await asUser(db.pool, ALICE, async (c) =>
      (await c.query("select first_name from profiles order by first_name")).rows.map((r) => r.first_name),
    );
    expect(names).toEqual(["Alice", "Bob", "Carla", "Dan"]);
  });

  it("chacun lit son propre profil complet via get_my_profile()", async () => {
    const me = await asUser(db.pool, ALICE, async (c) => (await c.query("select * from get_my_profile()")).rows[0]);
    expect(me.email).toBe("alice.test@ynov.com");
  });

  it("un utilisateur ne peut pas écrire directement dans les tables", async () => {
    const err = await expectSqlError(
      asUser(db.pool, ALICE, (c) =>
        c.query(
          `insert into events (school_id, organization_id, created_by, title, starts_at, location)
           values ($1, $2, $3, 'Pirate', now() + interval '1 day', 'X')`,
          [ROUEN, ORG_ROUEN_BDE, ALICE],
        ),
      ),
    );
    expect(err.code).toBe("42501");
  });

  it("un utilisateur ne peut pas se déclarer super-administrateur", async () => {
    const err = await expectSqlError(
      asUser(db.pool, ALICE, (c) => c.query("insert into platform_admins (user_id) values ($1)", [ALICE])),
    );
    expect(err.code).toBe("42501");
  });
});

describe("Inscriptions", () => {
  it("refuse l'inscription à un événement d'un autre campus", async () => {
    const err = await expectSqlError(
      asUser(db.pool, ALICE, (c) => c.query("select register_for_event($1)", [EVENT_LYON])),
    );
    expect(err.code).toBe("P0002");
  });

  it("inscrit Alice, et un double clic ne crée pas de doublon", async () => {
    const reg = (c: Parameters<Parameters<typeof asUser>[2]>[0]) =>
      c.query("select (register_for_event($1)).participants_count as n", [EVENT_ROUEN_PUBLISHED]);
    expect((await asUser(db.pool, ALICE, reg)).rows[0].n).toBe(1);
    expect((await asUser(db.pool, ALICE, reg)).rows[0].n).toBe(1);
  });

  it("refuse Bob : l'événement est complet (capacité 1)", async () => {
    const err = await expectSqlError(
      asUser(db.pool, BOB, (c) => c.query("select register_for_event($1)", [EVENT_ROUEN_PUBLISHED])),
    );
    expect(err.message).toBe("Événement complet");
  });

  it("la liste des participants est visible par l'école, pas par un autre campus", async () => {
    expect(await asUser(db.pool, BOB, (c) => count(c, "registrations"))).toBe(1);
    expect(await asUser(db.pool, EVE, (c) => count(c, "registrations"))).toBe(0);
  });

  it("une désinscription libère la place", async () => {
    const n = await asUser(
      db.pool,
      ALICE,
      async (c) =>
        (await c.query("select (unregister_from_event($1)).participants_count as n", [EVENT_ROUEN_PUBLISHED])).rows[0]
          .n,
    );
    expect(n).toBe(0);
    await asUser(db.pool, ALICE, (c) => c.query("select register_for_event($1)", [EVENT_ROUEN_PUBLISHED]));
  });
});

describe("Conversations et modération", () => {
  it("un non-inscrit ne peut pas écrire", async () => {
    const err = await expectSqlError(
      asUser(db.pool, BOB, (c) => c.query("select post_message($1, 'salut')", [EVENT_ROUEN_PUBLISHED])),
    );
    expect(err.code).toBe("42501");
  });

  it("une inscrite peut écrire", async () => {
    const r = await asUser(db.pool, ALICE, (c) =>
      c.query("select (post_message($1, 'Hâte d''y être')).id as id", [EVENT_ROUEN_PUBLISHED]),
    );
    expect(r.rows[0].id).toBeTruthy();
  });

  it("un non-inscrit ne peut pas lire les messages", async () => {
    expect(await asUser(db.pool, BOB, (c) => count(c, "messages"))).toBe(0);
  });

  it("l'organisatrice voit son brouillon, lit la conversation et écrit sous le profil BDE", async () => {
    await asUser(db.pool, CARLA, async (c) => {
      expect(await count(c, "events")).toBe(2);
      expect(await count(c, "messages")).toBe(1);
      await c.query("select post_message($1, 'Bienvenue !', $2)", [EVENT_ROUEN_PUBLISHED, ORG_ROUEN_BDE]);
    });
  });

  it("une étudiante ne peut pas écrire au nom d'une organisation", async () => {
    const err = await expectSqlError(
      asUser(db.pool, ALICE, (c) =>
        c.query("select post_message($1, 'faux', $2)", [EVENT_ROUEN_PUBLISHED, ORG_ROUEN_BDE]),
      ),
    );
    expect(err.code).toBe("42501");
  });

  it("la modération École lit toutes les conversations sans être inscrite", async () => {
    expect(await asUser(db.pool, DAN, (c) => count(c, "messages"))).toBe(2);
  });

  it("une étudiante d'un autre campus ne lit rien", async () => {
    expect(await asUser(db.pool, EVE, (c) => count(c, "messages"))).toBe(0);
  });

  it("un utilisateur dont l'écriture est suspendue ne peut plus écrire", async () => {
    await db.pool.query("update profiles set chat_suspended_until = now() + interval '1 day' where id = $1", [ALICE]);
    const err = await expectSqlError(
      asUser(db.pool, ALICE, (c) => c.query("select post_message($1, 'encore')", [EVENT_ROUEN_PUBLISHED])),
    );
    expect(err.message).toBe("Écriture suspendue");
    await db.pool.query("update profiles set chat_suspended_until = null where id = $1", [ALICE]);
  });
});

describe("Compte désactivé", () => {
  it("perd tout accès immédiatement, même avec une session encore valide", async () => {
    await db.pool.query("update profiles set status = 'deactivated' where id = $1", [ALICE]);
    await asUser(db.pool, ALICE, async (c) => {
      expect(await count(c, "events")).toBe(0);
      expect(await count(c, "messages")).toBe(0);
    });
  });

  it("ne peut plus recevoir de code de connexion", async () => {
    const ok = (await db.pool.query("select can_request_login('alice.test@ynov.com') as ok")).rows[0].ok;
    expect(ok).toBe(false);
  });
});
