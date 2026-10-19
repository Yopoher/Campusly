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
  MEMBER_DAN_SCHOOL,
  ROUEN,
  seedBaseline,
} from "./support/fixtures";

/**
 * Phase 5 : conversations, signalements et modération.
 * Alice est inscrite à l'événement publié de Rouen et peut envoyer/lire des messages.
 * Carla est au BDE avec events.chat et peut poster au nom de l'organisation.
 * Dan est modérateur de l'école (moderation.conversations, moderation.reports, moderation.suspend_chat).
 * Bob n'est pas inscrit. Eve est dans une autre école.
 */

let db: TestDb;
let aliceMessageId: number;
let carlaMessageId: number;
let reportId: string;

const as = <T>(user: string, fn: (c: import("pg").PoolClient) => Promise<T>) => asUser(db.pool, user, fn);

beforeAll(async () => {
  db = await createTestDatabase();
  await seedBaseline(db.pool);
  // Ajouter moderation.suspend_chat à Dan
  await db.pool.query(
    "insert into organization_member_permissions (member_id, permission) values ($1, 'moderation.suspend_chat')",
    [MEMBER_DAN_SCHOOL],
  );
  // Alice s'inscrit
  await as(ALICE, (c) => c.query("select register_for_event($1)", [EVENT_ROUEN_PUBLISHED]));
});

afterAll(async () => {
  await db?.drop();
});

describe("post_message", () => {
  it("un inscrit peut envoyer un message", async () => {
    const { rows } = await as(ALICE, (c) =>
      c.query("select * from post_message($1, $2)", [EVENT_ROUEN_PUBLISHED, "Salut tout le monde !"]),
    );
    expect(rows[0]).toMatchObject({
      author_id: ALICE,
      body: "Salut tout le monde !",
      moderation_status: "visible",
    });
    aliceMessageId = rows[0].id;
  });

  it("un membre avec events.chat peut poster au nom de l'organisation", async () => {
    const { rows } = await as(CARLA, (c) =>
      c.query("select * from post_message($1, $2, $3)", [
        EVENT_ROUEN_PUBLISHED,
        "Bienvenue !",
        // organization_id du BDE
        "a2000000-0000-0000-0000-000000000000",
      ]),
    );
    expect(rows[0].organization_id).toBe("a2000000-0000-0000-0000-000000000000");
    carlaMessageId = rows[0].id;
  });

  it("refuse un message vide", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select post_message($1, $2)", [EVENT_ROUEN_PUBLISHED, "   "])),
    );
    expect(err.code).toBeTruthy();
  });

  it("refuse un message de plus de 2000 caractères", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select post_message($1, $2)", [EVENT_ROUEN_PUBLISHED, "a".repeat(2001)])),
    );
    expect(err.code).toBeTruthy();
  });

  it("refuse l'envoi par un non-inscrit sans permission", async () => {
    const err = await expectSqlError(
      as(BOB, (c) => c.query("select post_message($1, $2)", [EVENT_ROUEN_PUBLISHED, "Hello"])),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse l'envoi sur un événement d'une autre école", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select post_message($1, $2)", [EVENT_LYON, "Coucou Lyon"])),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse l'envoi sur un brouillon", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select post_message($1, $2)", [EVENT_ROUEN_DRAFT, "Brouillon"])),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse l'envoi au nom d'une autre organisation", async () => {
    const err = await expectSqlError(
      as(CARLA, (c) =>
        c.query("select post_message($1, $2, $3)", [
          EVENT_ROUEN_PUBLISHED,
          "Usurpation",
          "a1000000-0000-0000-0000-000000000000", // ORG_ROUEN_SCHOOL
        ]),
      ),
    );
    expect(err.code).toBe("42501");
  });
});

describe("Lecture des messages (RLS)", () => {
  it("un inscrit voit les messages", async () => {
    const { rows } = await as(ALICE, (c) =>
      c.query("select id from messages where event_id = $1", [EVENT_ROUEN_PUBLISHED]),
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("un non-inscrit ne voit pas les messages", async () => {
    const { rows } = await as(BOB, (c) =>
      c.query("select id from messages where event_id = $1", [EVENT_ROUEN_PUBLISHED]),
    );
    expect(rows.length).toBe(0);
  });

  it("un modérateur de l'école voit les messages", async () => {
    const { rows } = await as(DAN, (c) =>
      c.query("select id from messages where event_id = $1", [EVENT_ROUEN_PUBLISHED]),
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("une personne d'une autre école ne voit rien", async () => {
    const { rows } = await as(EVE, (c) =>
      c.query("select id from messages where event_id = $1", [EVENT_ROUEN_PUBLISHED]),
    );
    expect(rows.length).toBe(0);
  });
});

describe("report_message", () => {
  it("un inscrit peut signaler le message d'un autre", async () => {
    // Alice signale le message de Carla
    const { rows } = await as(ALICE, (c) =>
      c.query("select * from report_message($1, $2)", [carlaMessageId, "Contenu inapproprié"]),
    );
    expect(rows[0]).toMatchObject({
      reporter_id: ALICE,
      status: "pending",
    });
    reportId = rows[0].id;
  });

  it("signaler deux fois le même message est idempotent", async () => {
    const { rows } = await as(ALICE, (c) => c.query("select * from report_message($1)", [carlaMessageId]));
    expect(rows[0].id).toBe(reportId);
  });

  it("un auteur ne peut pas signaler son propre message", async () => {
    const err = await expectSqlError(
      as(CARLA, (c) => c.query("select report_message($1)", [carlaMessageId])),
    );
    expect(err.code).toBe("P0001");
  });

  it("une personne sans accès ne peut pas signaler", async () => {
    const err = await expectSqlError(as(BOB, (c) => c.query("select report_message($1)", [aliceMessageId])));
    expect(err.code).toBe("42501");
  });

  it("écrit dans l'audit", async () => {
    const { rows } = await db.pool.query(
      "select action from audit_logs where action = 'message.reported' order by created_at desc limit 1",
    );
    expect(rows[0].action).toBe("message.reported");
  });
});

describe("hide_message", () => {
  it("un modérateur peut masquer un message", async () => {
    const { rows } = await as(DAN, (c) => c.query("select * from hide_message($1)", [aliceMessageId]));
    expect(rows[0]).toMatchObject({
      moderation_status: "hidden",
      moderated_by: DAN,
    });
    expect(rows[0].moderated_at).toBeTruthy();
  });

  it("un non-modérateur ne peut pas masquer", async () => {
    const err = await expectSqlError(as(ALICE, (c) => c.query("select hide_message($1)", [carlaMessageId])));
    expect(err.code).toBe("42501");
  });

  it("écrit dans l'audit", async () => {
    const { rows } = await db.pool.query(
      "select action, metadata from audit_logs where action = 'message.hidden' order by created_at desc limit 1",
    );
    expect(rows[0].action).toBe("message.hidden");
    expect(rows[0].metadata.author_id).toBe(ALICE);
  });
});

describe("handle_report", () => {
  it("un modérateur peut clore un signalement (resolved)", async () => {
    const { rows } = await as(DAN, (c) =>
      c.query("select * from handle_report($1, 'resolved')", [reportId]),
    );
    expect(rows[0]).toMatchObject({
      status: "resolved",
      handled_by: DAN,
    });
  });

  it("un non-modérateur ne peut pas traiter un signalement", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select handle_report($1, 'dismissed')", [reportId])),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse une action invalide", async () => {
    const err = await expectSqlError(
      as(DAN, (c) => c.query("select handle_report($1, 'pending')", [reportId])),
    );
    expect(err.code).toBe("22023");
  });
});

describe("suspend_chat_user / unsuspend_chat_user", () => {
  it("un modérateur peut suspendre un étudiant", async () => {
    await as(DAN, (c) =>
      c.query("select suspend_chat_user($1, now() + interval '1 hour')", [ALICE]),
    );
    const { rows } = await db.pool.query("select chat_suspended_until from profiles where id = $1", [ALICE]);
    expect(rows[0].chat_suspended_until).toBeTruthy();
  });

  it("un étudiant suspendu ne peut plus poster", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select post_message($1, $2)", [EVENT_ROUEN_PUBLISHED, "Je suis suspendu"])),
    );
    expect(err.code).toBe("42501");
  });

  it("un modérateur peut lever la suspension", async () => {
    await as(DAN, (c) => c.query("select unsuspend_chat_user($1)", [ALICE]));
    const { rows } = await db.pool.query("select chat_suspended_until from profiles where id = $1", [ALICE]);
    expect(rows[0].chat_suspended_until).toBeNull();
  });

  it("un étudiant ne peut pas suspendre", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select suspend_chat_user($1, now() + interval '1 hour')", [BOB])),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse de suspendre un utilisateur d'une autre école", async () => {
    const err = await expectSqlError(
      as(DAN, (c) => c.query("select suspend_chat_user($1, now() + interval '1 hour')", [EVE])),
    );
    expect(err.code).toBe("P0002");
  });
});

describe("Conversation en lecture seule (événement annulé)", () => {
  it("refuse l'envoi sur un événement annulé", async () => {
    // Donner la permission d'annulation à Carla et annuler
    await db.pool.query(
      "insert into organization_member_permissions (member_id, permission) values ($1, 'events.cancel') on conflict do nothing",
      [MEMBER_CARLA_BDE],
    );
    await as(CARLA, (c) =>
      c.query("select cancel_event($1, 'Annulé pour test')", [EVENT_ROUEN_PUBLISHED]),
    );
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select post_message($1, $2)", [EVENT_ROUEN_PUBLISHED, "Après annulation"])),
    );
    expect(err.code).toBe("P0001");
  });

  it("les messages restent lisibles après annulation", async () => {
    const { rows } = await as(ALICE, (c) =>
      c.query("select id from messages where event_id = $1", [EVENT_ROUEN_PUBLISHED]),
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});
