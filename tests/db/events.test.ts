import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, asUser, createTestDatabase, expectSqlError, type TestDb } from "./support/database";
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
  ORG_ROUEN_SCHOOL,
  ROUEN,
  seedBaseline,
} from "./support/fixtures";

/**
 * Événements (cahier des charges §7 à §10, critères 20.3).
 * Les tests s'enchaînent dans l'ordre : chaque bloc utilise l'état laissé par le précédent.
 */
let db: TestDb;
let eventDraftId = "";
let eventPastId = "";

beforeAll(async () => {
  db = await createTestDatabase();
  await seedBaseline(db.pool);
  // Carla publie pour le BDE : elle a besoin des droits de modification et d'annulation pour ces tests.
  await db.pool.query(
    `insert into organization_member_permissions (member_id, permission) values
       ($1, 'events.edit'), ($1, 'events.cancel')`,
    [MEMBER_CARLA_BDE],
  );
});
afterAll(async () => {
  await db?.drop();
});

const as = <T>(user: string, fn: (c: import("pg").PoolClient) => Promise<T>) => asUser(db.pool, user, fn);
const lastAudit = async (action: string) =>
  (
    await db.pool.query(
      "select actor_id, school_id, metadata from audit_logs where action = $1 order by created_at desc limit 1",
      [action],
    )
  ).rows[0];

describe("Création d'un événement", () => {
  const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

  it("crée un brouillon au nom de l'organisation et enregistre l'auteur réel", async () => {
    const { rows } = await as(CARLA, (c) =>
      c.query(
        `select create_event($1, 'Tournoi de fléchettes', 'Ouvert à tous', $2, null, 'Foyer', 20, null, null, false) as id`,
        [ORG_ROUEN_BDE, future(5)],
      ),
    );
    eventDraftId = rows[0].id;
    const { rows: stored } = await db.pool.query(
      "select status, school_id, organization_id, created_by from events where id = $1",
      [eventDraftId],
    );
    expect(stored[0]).toMatchObject({
      status: "draft",
      school_id: ROUEN,
      organization_id: ORG_ROUEN_BDE,
      created_by: CARLA,
    });
    expect((await lastAudit("event.created")).actor_id).toBe(CARLA);
  });

  it("refuse la création à un étudiant sans permission", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) =>
        c.query(`select create_event($1, 'Intrus', '', $2, null, 'Foyer', null, null, null, true)`, [
          ORG_ROUEN_BDE,
          future(5),
        ]),
      ),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse la création à un membre de l'école sans permission d'événement", async () => {
    const err = await expectSqlError(
      as(DAN, (c) =>
        c.query(`select create_event($1, 'Intrus', '', $2, null, 'Foyer', null, null, null, true)`, [
          ORG_ROUEN_SCHOOL,
          future(5),
        ]),
      ),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse la création pour une organisation d'un autre campus", async () => {
    const err = await expectSqlError(
      as(EVE, (c) =>
        c.query(`select create_event($1, 'Intrus', '', $2, null, 'Foyer', null, null, null, true)`, [
          ORG_ROUEN_BDE,
          future(5),
        ]),
      ),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse une date de début dans le passé", async () => {
    const err = await expectSqlError(
      as(CARLA, (c) =>
        c.query(`select create_event($1, 'Passé', '', $2, null, 'Foyer', null, null, null, false)`, [
          ORG_ROUEN_BDE,
          future(-1),
        ]),
      ),
    );
    expect(err.code).toBe("22023");
  });

  it("refuse une URL externe qui n'est pas en https", async () => {
    const err = await expectSqlError(
      as(CARLA, (c) =>
        c.query(`select create_event($1, 'Lien', '', $2, null, 'Foyer', null, null, 'http://exemple.test', false)`, [
          ORG_ROUEN_BDE,
          future(5),
        ]),
      ),
    );
    expect(err.code).toBe("23514");
  });
});

describe("Publication", () => {
  it("publie un brouillon et enregistre la date de publication", async () => {
    await as(CARLA, (c) => c.query("select publish_event($1)", [eventDraftId]));
    const { rows } = await db.pool.query("select status, published_at from events where id = $1", [eventDraftId]);
    expect(rows[0].status).toBe("published");
    expect(rows[0].published_at).not.toBeNull();
  });

  it("refuse de publier un événement déjà publié", async () => {
    const err = await expectSqlError(as(CARLA, (c) => c.query("select publish_event($1)", [eventDraftId])));
    expect(err.code).toBe("P0001");
  });

  it("refuse la publication à un membre sans events.create", async () => {
    // Brouillon créé directement en base, pour tester la seule règle de permission.
    const draft = await db.pool.query(
      `insert into events (school_id, organization_id, created_by, title, starts_at, location)
       values ($1, $2, $3, 'Brouillon à publier', now() + interval '6 days', 'Foyer') returning id`,
      [ROUEN, ORG_ROUEN_BDE, CARLA],
    );
    const err = await expectSqlError(as(ALICE, (c) => c.query("select publish_event($1)", [draft.rows[0].id])));
    expect(err.code).toBe("42501");
  });
});

describe("Modification", () => {
  it("modifie un détail mineur sans changement de date ni de lieu", async () => {
    await as(CARLA, (c) =>
      c.query(
        `select update_event($1, 'Soirée intégration (mise à jour)', 'Nouvelle description', starts_at, ends_at, location, capacity, registration_deadline, null)
         from events where id = $1`,
        [EVENT_ROUEN_PUBLISHED],
      ),
    );
    const { rows } = await db.pool.query("select title, description, updated_by from events where id = $1", [
      EVENT_ROUEN_PUBLISHED,
    ]);
    expect(rows[0]).toMatchObject({
      title: "Soirée intégration (mise à jour)",
      description: "Nouvelle description",
      updated_by: CARLA,
    });
    expect((await lastAudit("event.updated")).metadata).toEqual({ major: false });
  });

  it("signale un changement de lieu comme majeur dans l'audit", async () => {
    await as(CARLA, (c) =>
      c.query(
        `select update_event($1, title, description, starts_at, ends_at, 'Salle B12', capacity, registration_deadline, null)
         from events where id = $1`,
        [EVENT_ROUEN_PUBLISHED],
      ),
    );
    expect((await lastAudit("event.updated")).metadata).toEqual({ major: true });
  });

  it("refuse la modification à un membre qui n'a pas events.edit", async () => {
    const err = await expectSqlError(
      as(DAN, (c) =>
        c.query(
          "select update_event($1, 'Piratage', '', starts_at, null, 'Ailleurs', null, null, null) from events where id = $1",
          [EVENT_ROUEN_PUBLISHED],
        ),
      ),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse une capacité inférieure au nombre d'inscrits", async () => {
    await as(CARLA, (c) =>
      c.query(
        "select update_event($1, title, description, starts_at, ends_at, location, 2, registration_deadline, null) from events where id = $1",
        [EVENT_ROUEN_PUBLISHED],
      ),
    );
    await as(ALICE, (c) => c.query("select register_for_event($1)", [EVENT_ROUEN_PUBLISHED]));
    await as(BOB, (c) => c.query("select register_for_event($1)", [EVENT_ROUEN_PUBLISHED]));
    const err = await expectSqlError(
      as(CARLA, (c) =>
        c.query(
          "select update_event($1, title, description, starts_at, ends_at, location, 1, registration_deadline, null) from events where id = $1",
          [EVENT_ROUEN_PUBLISHED],
        ),
      ),
    );
    expect(err.code).toBe("22023");
    expect(err.message).toMatch(/2 inscrit/);
  });
});

describe("Annulation", () => {
  it("refuse l'annulation d'un brouillon", async () => {
    const err = await expectSqlError(as(CARLA, (c) => c.query("select cancel_event($1, 'Non')", [EVENT_ROUEN_DRAFT])));
    expect(err.code).toBe("P0001");
  });

  it("refuse l'annulation à un membre sans events.cancel", async () => {
    const err = await expectSqlError(
      as(DAN, (c) => c.query("select cancel_event($1, 'Non')", [EVENT_ROUEN_PUBLISHED])),
    );
    expect(err.code).toBe("42501");
  });

  it("annule sans supprimer : les inscriptions restent, le statut et le motif sont enregistrés", async () => {
    await as(CARLA, (c) => c.query("select cancel_event($1, 'Salle indisponible')", [EVENT_ROUEN_PUBLISHED]));
    const { rows } = await db.pool.query(
      "select status, cancellation_reason, participants_count from events where id = $1",
      [EVENT_ROUEN_PUBLISHED],
    );
    expect(rows[0]).toMatchObject({
      status: "cancelled",
      cancellation_reason: "Salle indisponible",
      participants_count: 2,
    });
    const { rows: regs } = await db.pool.query(
      "select count(*) as n from registrations where event_id = $1 and status = 'registered'",
      [EVENT_ROUEN_PUBLISHED],
    );
    expect(Number(regs[0].n)).toBe(2);
  });

  it("interdit toute modification d'un événement annulé", async () => {
    const err = await expectSqlError(
      as(CARLA, (c) =>
        c.query(
          "select update_event($1, 'Retour', '', starts_at, null, 'Foyer', null, null, null) from events where id = $1",
          [EVENT_ROUEN_PUBLISHED],
        ),
      ),
    );
    expect(err.code).toBe("P0001");
  });

  it("refuse une nouvelle inscription à un événement annulé", async () => {
    const err = await expectSqlError(as(EVE, (c) => c.query("select register_for_event($1)", [EVENT_ROUEN_PUBLISHED])));
    expect(err.code).toBe("P0002");
  });
});

describe("Visibilité du fil et des détails", () => {
  it("le fil « à venir » d'un étudiant ne contient que les événements publiés ou annulés de son école", async () => {
    const { rows } = await as(ALICE, (c) => c.query("select id, status from list_events('upcoming')"));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(EVENT_ROUEN_PUBLISHED);
    expect(ids).not.toContain(EVENT_ROUEN_DRAFT);
    expect(ids).not.toContain(EVENT_LYON);
    expect(rows.find((r) => r.id === EVENT_ROUEN_PUBLISHED)?.status).toBe("cancelled");
  });

  it("un brouillon n'est jamais visible hors de son organisation, même avec son identifiant", async () => {
    const err = await expectSqlError(as(ALICE, (c) => c.query("select * from get_event($1)", [EVENT_ROUEN_DRAFT])));
    expect(err.code).toBe("P0002");
    const { rows } = await as(CARLA, (c) => c.query("select id from get_event($1)", [EVENT_ROUEN_DRAFT]));
    expect(rows[0].id).toBe(EVENT_ROUEN_DRAFT);
  });

  it("un membre d'un autre campus ne voit aucun événement de Rouen", async () => {
    const { rows } = await as(EVE, (c) => c.query("select id from list_events('upcoming')"));
    expect(rows.map((r) => r.id)).toEqual([EVENT_LYON]);
    const err = await expectSqlError(as(EVE, (c) => c.query("select * from get_event($1)", [EVENT_ROUEN_PUBLISHED])));
    expect(err.code).toBe("P0002");
  });

  it("les événements passés n'apparaissent que dans l'onglet « passés »", async () => {
    const { rows } = await db.pool.query(
      `insert into events (school_id, organization_id, created_by, title, starts_at, ends_at, location, status, published_at)
       values ($1, $2, $3, 'Conférence passée', now() - interval '3 days', now() - interval '3 days' + interval '2 hours', 'Amphi', 'published', now() - interval '4 days')
       returning id`,
      [ROUEN, ORG_ROUEN_BDE, CARLA],
    );
    eventPastId = rows[0].id;
    const upcoming = await as(ALICE, (c) => c.query("select id from list_events('upcoming')"));
    expect(upcoming.rows.map((r) => r.id)).not.toContain(eventPastId);
    const past = await as(ALICE, (c) => c.query("select id, is_past from list_events('past')"));
    expect(past.rows).toEqual([{ id: eventPastId, is_past: true }]);
  });

  it("« mes événements » ne contient que les inscriptions actives à venir", async () => {
    const { rows } = await as(ALICE, (c) => c.query("select id, registered from list_events('mine')"));
    expect(rows.map((r) => r.id)).toEqual([EVENT_ROUEN_PUBLISHED]);
    expect(rows[0].registered).toBe(true);
  });

  it("la gestion d'une organisation affiche les brouillons, réservée à ses membres", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select id from list_managed_events($1)", [ORG_ROUEN_BDE])),
    );
    expect(err.code).toBe("42501");
    const { rows } = await as(CARLA, (c) => c.query("select id from list_managed_events($1)", [ORG_ROUEN_BDE]));
    expect(rows.map((r) => r.id)).toEqual(
      expect.arrayContaining([EVENT_ROUEN_PUBLISHED, EVENT_ROUEN_DRAFT, eventPastId]),
    );
  });

  it("le profil d'une organisation est lisible dans l'école et invisible hors de l'école", async () => {
    const own = await as(ALICE, (c) => c.query("select name from get_organization($1)", [ORG_ROUEN_BDE]));
    expect(own.rows).toEqual([{ name: "BDE Rouen" }]);
    const other = await as(EVE, (c) => c.query("select name from get_organization($1)", [ORG_ROUEN_BDE]));
    expect(other.rows).toEqual([]);
  });

  it("les lectures demandées sans connexion sont refusées", async () => {
    const err = await expectSqlError(asRole(db.pool, "anon", (c) => c.query("select * from list_events('upcoming')")));
    expect(err.code).toBe("42501");
  });

  it("la vue de lecture applique elle aussi les règles : pas de brouillon pour un étudiant", async () => {
    const { rows } = await as(ALICE, (c) => c.query("select id from event_cards where status = 'draft'"));
    expect(rows).toEqual([]);
  });

  it("aucune écriture directe sur la table depuis le client, même pour le créateur", async () => {
    const err = await expectSqlError(
      as(CARLA, (c) => c.query(`update events set title = 'Direct' where id = $1`, [EVENT_ROUEN_DRAFT])),
    );
    expect(err.code).toBe("42501");
    const err2 = await expectSqlError(
      as(ALICE, (c) =>
        c.query(
          `insert into events (school_id, organization_id, created_by, title, starts_at, location)
                                 values ($1, $2, $3, 'Direct', now() + interval '1 day', 'Foyer')`,
          [ROUEN, ORG_ROUEN_BDE, ALICE],
        ),
      ),
    );
    expect(err2.code).toBe("42501");
  });

  it("un parcours inconnu est refusé", async () => {
    const err = await expectSqlError(as(ALICE, (c) => c.query("select * from list_events('tout')")));
    expect(err.code).toBe("22023");
  });
});

describe("Inscriptions et participants", () => {
  it("la liste des participants ne contient que les inscrits actifs, sans adresse e-mail", async () => {
    const list = await as(ALICE, (c) => c.query("select * from list_event_participants($1)", [EVENT_ROUEN_PUBLISHED]));
    expect(list.rows.map((r) => r.first_name).sort()).toEqual(["Alice", "Bob"]);
    expect(Object.keys(list.rows[0])).not.toContain("email");
  });

  it("refuse la liste des participants d'un événement d'un autre campus", async () => {
    const err = await expectSqlError(
      as(EVE, (c) => c.query("select * from list_event_participants($1)", [EVENT_ROUEN_PUBLISHED])),
    );
    expect(err.code).toBe("P0002");
  });

  it("une désinscription libère une place et retire l'événement de « mes événements »", async () => {
    await as(BOB, (c) => c.query("select unregister_from_event($1)", [EVENT_ROUEN_PUBLISHED]));
    const { rows } = await db.pool.query("select participants_count from events where id = $1", [
      EVENT_ROUEN_PUBLISHED,
    ]);
    expect(rows[0].participants_count).toBe(1);
    const list = await as(ALICE, (c) =>
      c.query("select first_name from list_event_participants($1)", [EVENT_ROUEN_PUBLISHED]),
    );
    expect(list.rows.map((r) => r.first_name)).toEqual(["Alice"]);
  });

  it("le drapeau « inscrit » et « inscriptions ouvertes » reflètent l'état réel", async () => {
    const { rows } = await as(ALICE, (c) =>
      c.query("select registered, registration_open from get_event($1)", [EVENT_ROUEN_PUBLISHED]),
    );
    expect(rows[0]).toEqual({ registered: true, registration_open: false });
  });

  it("refuse l'inscription après la date limite", async () => {
    const { rows } = await db.pool.query(
      `insert into events (school_id, organization_id, created_by, title, starts_at, registration_deadline, location, status, published_at)
       values ($1, $2, $3, 'Inscriptions closes', now() + interval '2 days', now() - interval '1 hour', 'Foyer', 'published', now())
       returning id`,
      [ROUEN, ORG_ROUEN_BDE, CARLA],
    );
    const err = await expectSqlError(as(BOB, (c) => c.query("select register_for_event($1)", [rows[0].id])));
    expect(err.code).toBe("P0001");
  });

  it("refuse l'inscription à un brouillon", async () => {
    const err = await expectSqlError(as(ALICE, (c) => c.query("select register_for_event($1)", [EVENT_ROUEN_DRAFT])));
    expect(err.code).toBe("P0002");
  });
});

describe("Profil d'organisation et organisation désactivée", () => {
  it("une organisation désactivée n'expose plus ses événements", async () => {
    await db.pool.query("update organizations set status = 'disabled' where id = $1", [ORG_ROUEN_BDE]);
    const { rows } = await as(ALICE, (c) => c.query("select id from list_events('upcoming')"));
    expect(rows).toEqual([]);
    const org = await as(ALICE, (c) => c.query("select name from get_organization($1)", [ORG_ROUEN_BDE]));
    expect(org.rows).toEqual([]);
  });
});
