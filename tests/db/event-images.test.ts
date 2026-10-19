import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, expectSqlError, type TestDb } from "./support/database";
import {
  ALICE,
  CARLA,
  EVE,
  EVENT_LYON,
  EVENT_ROUEN_DRAFT,
  EVENT_ROUEN_PUBLISHED,
  LYON,
  MEMBER_CARLA_BDE,
  ROUEN,
  seedBaseline,
} from "./support/fixtures";

/**
 * Images d'événements (docs/SECURITY.md §5.3) : bucket privé, politiques Storage, enregistrement du chemin.
 * Les tests jouent le rôle du serveur : l'envoi passe par le compte de l'utilisateur, comme en production.
 */
const EVENT_CANCELLED = "e4000000-0000-0000-0000-000000000000";

let db: TestDb;
let imageOne = "";
let imageTwo = "";

const newName = (school: string, event: string) => `${school}/${event}/${randomUUID()}.webp`;
const as = <T>(user: string, fn: (c: import("pg").PoolClient) => Promise<T>) => asUser(db.pool, user, fn);

async function upload(user: string, name: string) {
  return as(user, (c) =>
    c.query("insert into storage.objects (bucket_id, name, owner) values ('event-images', $1, $2) returning name", [
      name,
      user,
    ]),
  );
}

async function visibleImages(user: string, name: string) {
  const { rows } = await as(user, (c) =>
    c.query("select name from storage.objects where bucket_id = 'event-images' and name = $1", [name]),
  );
  return rows.length;
}

beforeAll(async () => {
  db = await createTestDatabase();
  await seedBaseline(db.pool);
  // Carla gère le BDE : elle doit pouvoir modifier les événements pour ajouter une image.
  await db.pool.query(
    "insert into organization_member_permissions (member_id, permission) values ($1, 'events.edit')",
    [MEMBER_CARLA_BDE],
  );
  await db.pool.query(
    `insert into events (id, school_id, organization_id, created_by, title, starts_at, location, status)
     values ($1, $2, (select organization_id from events where id = $3), $4, 'Annulé', now() + interval '2 days', 'Rouen', 'cancelled')`,
    [EVENT_CANCELLED, ROUEN, EVENT_ROUEN_PUBLISHED, CARLA],
  );
});
afterAll(async () => {
  await db?.drop();
});

describe("Bucket et politiques Storage", () => {
  it("le bucket est privé et n'accepte que le format WebP, 4 Mo au plus", async () => {
    const { rows } = await db.pool.query(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'event-images'",
    );
    expect(rows[0]).toMatchObject({
      public: false,
      file_size_limit: "4194304",
      allowed_mime_types: ["image/webp"],
    });
  });

  it("un éditeur du BDE peut ajouter une image dans le dossier d'un de ses événements", async () => {
    imageOne = newName(ROUEN, EVENT_ROUEN_PUBLISHED);
    const { rows } = await upload(CARLA, imageOne);
    expect(rows[0].name).toBe(imageOne);
  });

  it("refuse l'ajout à un étudiant sans permission", async () => {
    const err = await expectSqlError(upload(ALICE, newName(ROUEN, EVENT_ROUEN_PUBLISHED)));
    expect(err.code).toBe("42501");
  });

  it("refuse un nom qui ne respecte pas le format généré par le serveur", async () => {
    const err = await expectSqlError(upload(CARLA, `${ROUEN}/${EVENT_ROUEN_PUBLISHED}/photo.jpg`));
    expect(err.code).toBe("42501");
  });

  it("refuse l'ajout dans l'école d'une autre école, même avec la permission", async () => {
    const err = await expectSqlError(upload(CARLA, newName(LYON, EVENT_LYON)));
    expect(err.code).toBe("42501");
  });

  it("refuse l'ajout sur un événement annulé", async () => {
    const err = await expectSqlError(upload(CARLA, newName(ROUEN, EVENT_CANCELLED)));
    expect(err.code).toBe("42501");
  });

  it("un élève de l'école voit l'image d'un événement publié", async () => {
    expect(await visibleImages(ALICE, imageOne)).toBe(1);
  });

  it("l'image d'un brouillon n'est visible que de l'organisation", async () => {
    imageTwo = newName(ROUEN, EVENT_ROUEN_DRAFT);
    await upload(CARLA, imageTwo);
    expect(await visibleImages(CARLA, imageTwo)).toBe(1);
    expect(await visibleImages(ALICE, imageTwo)).toBe(0);
  });

  it("une personne d'une autre école ne voit aucune image de cette école", async () => {
    expect(await visibleImages(EVE, imageOne)).toBe(0);
  });

  it("un étudiant ne peut pas supprimer une image, un éditeur le peut", async () => {
    const byAlice = await as(ALICE, (c) =>
      c.query("delete from storage.objects where bucket_id = 'event-images' and name = $1", [imageTwo]),
    );
    expect(byAlice.rowCount).toBe(0);
    expect(await visibleImages(CARLA, imageTwo)).toBe(1);
  });

  it("l'image d'un événement annulé reste visible de l'école", async () => {
    const name = newName(ROUEN, EVENT_CANCELLED);
    await db.pool.query("insert into storage.objects (bucket_id, name) values ('event-images', $1)", [name]);
    expect(await visibleImages(ALICE, name)).toBe(1);
  });
});

describe("set_event_image", () => {
  const eventImage = async (id: string) =>
    (await db.pool.query("select image_path from events where id = $1", [id])).rows[0].image_path;

  it("enregistre le chemin, renvoie l'ancien (aucun) et écrit l'audit", async () => {
    const { rows } = await as(CARLA, (c) =>
      c.query("select set_event_image($1, $2) as previous", [EVENT_ROUEN_PUBLISHED, imageOne]),
    );
    expect(rows[0].previous).toBeNull();
    expect(await eventImage(EVENT_ROUEN_PUBLISHED)).toBe(imageOne);
    const audit = await db.pool.query(
      "select actor_id, school_id, metadata from audit_logs where action = 'event.image_changed' order by created_at desc limit 1",
    );
    expect(audit.rows[0]).toMatchObject({ actor_id: CARLA, school_id: ROUEN, metadata: { removed: false } });
  });

  it("remplacer renvoie l'image précédente, pour qu'elle soit supprimée", async () => {
    imageTwo = newName(ROUEN, EVENT_ROUEN_PUBLISHED);
    await upload(CARLA, imageTwo);
    const { rows } = await as(CARLA, (c) =>
      c.query("select set_event_image($1, $2) as previous", [EVENT_ROUEN_PUBLISHED, imageTwo]),
    );
    expect(rows[0].previous).toBe(imageOne);
    expect(await eventImage(EVENT_ROUEN_PUBLISHED)).toBe(imageTwo);
  });

  it("refuse un objet qui désigne un autre événement", async () => {
    const err = await expectSqlError(
      as(CARLA, (c) =>
        c.query("select set_event_image($1, $2)", [EVENT_ROUEN_PUBLISHED, newName(ROUEN, EVENT_ROUEN_DRAFT)]),
      ),
    );
    expect(err.code).toBe("22023");
  });

  it("refuse un objet d'une autre école", async () => {
    const err = await expectSqlError(
      as(CARLA, (c) =>
        c.query("select set_event_image($1, $2)", [EVENT_ROUEN_PUBLISHED, newName(LYON, EVENT_ROUEN_PUBLISHED)]),
      ),
    );
    expect(err.code).toBe("22023");
  });

  it("refuse un objet qui n'a pas été envoyé", async () => {
    const err = await expectSqlError(
      as(CARLA, (c) =>
        c.query("select set_event_image($1, $2)", [
          EVENT_ROUEN_PUBLISHED,
          `${ROUEN}/${EVENT_ROUEN_PUBLISHED}/${randomUUID()}.webp`,
        ]),
      ),
    );
    expect(err.code).toBe("P0002");
  });

  it("refuse la modification à un étudiant sans permission", async () => {
    const err = await expectSqlError(
      as(ALICE, (c) => c.query("select set_event_image($1, $2)", [EVENT_ROUEN_PUBLISHED, imageTwo])),
    );
    expect(err.code).toBe("42501");
  });

  it("refuse la modification d'un événement annulé", async () => {
    const name = newName(ROUEN, EVENT_CANCELLED);
    await db.pool.query("insert into storage.objects (bucket_id, name) values ('event-images', $1)", [name]);
    const err = await expectSqlError(
      as(CARLA, (c) => c.query("select set_event_image($1, $2)", [EVENT_CANCELLED, name])),
    );
    expect(err.code).toBe("P0001");
  });

  it("retirer l'image met le chemin à vide et écrit l'audit", async () => {
    const { rows } = await as(CARLA, (c) =>
      c.query("select set_event_image($1, null) as previous", [EVENT_ROUEN_PUBLISHED]),
    );
    expect(rows[0].previous).toBe(imageTwo);
    expect(await eventImage(EVENT_ROUEN_PUBLISHED)).toBeNull();
    const audit = await db.pool.query(
      "select metadata from audit_logs where action = 'event.image_changed' order by created_at desc limit 1",
    );
    expect(audit.rows[0].metadata).toMatchObject({ removed: true });
  });

  it("la fonction n'est pas appelable par un visiteur non connecté", async () => {
    const client = await db.pool.connect();
    try {
      await client.query("set role anon");
      await expectSqlError(client.query("select set_event_image($1, null)", [EVENT_ROUEN_PUBLISHED]));
    } finally {
      await client.query("reset role");
      client.release();
    }
  });

  it("refuse de modifier l'image d'un événement d'une autre école", async () => {
    const name = newName(LYON, EVENT_LYON);
    await db.pool.query("insert into storage.objects (bucket_id, name) values ('event-images', $1)", [name]);
    const err = await expectSqlError(as(CARLA, (c) => c.query("select set_event_image($1, $2)", [EVENT_LYON, name])));
    expect(err.code).toBe("42501");
  });
});
