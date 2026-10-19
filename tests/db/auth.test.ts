import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asRole, asUser, createTestDatabase, expectSqlError, type TestDb } from "./support/database";
import { ALICE, LYON, ROUEN, seedBaseline } from "./support/fixtures";

/** Connexion, création de compte et profil (cahier des charges §5, tests 20.1). */
let db: TestDb;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedBaseline(db.pool);
});
afterAll(async () => {
  await db?.drop();
});

const precheck = (email: string, ip: string | null = null) =>
  asRole(
    db.pool,
    "service_role",
    async (c) => (await c.query("select login_precheck($1, $2) as r", [email, ip])).rows[0].r,
  );

const hook = (email: string) =>
  asRole(
    db.pool,
    "supabase_auth_admin",
    async (c) =>
      (await c.query("select hook_before_user_created($1::jsonb) as r", [JSON.stringify({ user: { email } })])).rows[0]
        .r,
  );

/** Simule ce que fait Supabase Auth à la vérification du premier code : créer l'utilisateur. */
async function createAuthUser(id: string, email: string) {
  await db.pool.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
}

describe("Avant l'envoi d'un code", () => {
  it("accepte une adresse autorisée et refuse les autres, avec le même traitement côté serveur", async () => {
    expect(await precheck("bob.test@ynov.com")).toBe("ok");
    expect(await precheck("personne@ynov.com")).toBe("denied");
  });

  it("limite à 20 demandes par adresse et par heure, même pour une adresse inconnue", async () => {
    const email = "insistant.test@ynov.com";
    const results = [];
    for (let i = 0; i < 21; i++) results.push(await precheck(email));
    expect(results.slice(0, 20)).toEqual(Array(20).fill("denied"));
    expect(results[20]).toBe("throttled");
  });

  it("limite à 500 demandes par adresse IP et par heure", async () => {
    const results = [];
    for (let i = 0; i < 501; i++) results.push(await precheck(`robot${i}.test@ynov.com`, "ip-hash-robot"));
    expect(results.filter((r) => r === "throttled")).toHaveLength(1);
    expect(results[500]).toBe("throttled");
  });

  it("ne stocke pas les adresses en clair dans le suivi des demandes", async () => {
    const { rows } = await db.pool.query("select email_hash from login_attempts limit 1");
    expect(rows[0].email_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("n'est appelable ni par un visiteur ni par un utilisateur connecté", async () => {
    expect(
      (await expectSqlError(asRole(db.pool, "anon", (c) => c.query("select login_precheck('a@ynov.com')")))).code,
    ).toBe("42501");
    expect(
      (await expectSqlError(asUser(db.pool, ALICE, (c) => c.query("select login_precheck('a@ynov.com')")))).code,
    ).toBe("42501");
  });
});

describe("Hook d'Auth « avant création d'un utilisateur »", () => {
  it("laisse passer une adresse autorisée", async () => {
    expect(await hook("Bob.Test@ynov.com")).toEqual({});
  });

  it("refuse une adresse non autorisée avec un code 403", async () => {
    const r = await hook("intrus@gmail.com");
    expect(r.error.http_code).toBe(403);
  });

  it("n'est pas appelable par un visiteur", async () => {
    const err = await expectSqlError(
      asRole(db.pool, "anon", (c) => c.query("select hook_before_user_created('{}'::jsonb)")),
    );
    expect(err.code).toBe("42501");
  });
});

describe("Création du compte à la première connexion", () => {
  const FRANK = "00000000-0000-0000-0000-0000000000f1";

  it("crée le profil rattaché à l'école, avec le type et les noms de la liste", async () => {
    await db.pool.query(
      `insert into allowed_emails (school_id, email, person_type, first_name, last_name)
       values ($1, 'frank.test@ynov.com', 'staff', 'Frank', 'Petit')`,
      [ROUEN],
    );
    await createAuthUser(FRANK, "Frank.Test@ynov.com");
    const { rows } = await db.pool.query(
      "select school_id, person_type, first_name, last_name, email from profiles where id = $1",
      [FRANK],
    );
    expect(rows[0]).toEqual({
      school_id: ROUEN,
      person_type: "staff",
      first_name: "Frank",
      last_name: "Petit",
      email: "frank.test@ynov.com",
    });
  });

  it("refuse le rattachement si l'adresse est autorisée dans deux écoles", async () => {
    await db.pool.query(
      `insert into allowed_emails (school_id, email) values ($1, 'double.test@ynov.com'), ($2, 'double.test@ynov.com')`,
      [ROUEN, LYON],
    );
    const err = await expectSqlError(createAuthUser("00000000-0000-0000-0000-0000000000f2", "double.test@ynov.com"));
    expect(err.message).toMatch(/plusieurs écoles/);
  });

  it("un compte sans profil (hors liste) n'accède à rien", async () => {
    const GHOST = "00000000-0000-0000-0000-0000000000f3";
    await createAuthUser(GHOST, "fantome@gmail.com");
    const n = await asUser(db.pool, GHOST, async (c) =>
      Number((await c.query("select count(*) from events")).rows[0].count),
    );
    expect(n).toBe(0);
  });
});

describe("Retrait de la liste autorisée", () => {
  it("bloque immédiatement le compte, puis le réactive si l'adresse est ré-autorisée", async () => {
    await db.pool.query("update allowed_emails set status = 'removed' where email = 'alice.test@ynov.com'");
    expect((await db.pool.query("select status from profiles where id = $1", [ALICE])).rows[0].status).toBe(
      "unauthorized",
    );
    expect(await precheck("alice.test@ynov.com", "ip-alice")).toBe("denied");
    const visible = await asUser(db.pool, ALICE, async (c) =>
      Number((await c.query("select count(*) from events")).rows[0].count),
    );
    expect(visible).toBe(0);

    await db.pool.query("update allowed_emails set status = 'authorized' where email = 'alice.test@ynov.com'");
    expect((await db.pool.query("select status from profiles where id = $1", [ALICE])).rows[0].status).toBe("active");
  });
});

describe("Profil de l'utilisateur", () => {
  it("met à jour prénom, nom et présentation en nettoyant les espaces", async () => {
    const p = await asUser(
      db.pool,
      ALICE,
      async (c) => (await c.query("select * from update_my_profile('  Alice ', 'Martin', '  B1 dev web ')")).rows[0],
    );
    expect([p.first_name, p.last_name, p.bio]).toEqual(["Alice", "Martin", "B1 dev web"]);
  });

  it("refuse un prénom vide ou une présentation trop longue", async () => {
    const empty = await expectSqlError(
      asUser(db.pool, ALICE, (c) => c.query("select update_my_profile('', 'Martin')")),
    );
    expect(empty.message).toMatch(/prénom/);
    const long = await expectSqlError(
      asUser(db.pool, ALICE, (c) => c.query("select update_my_profile('Alice', 'Martin', $1)", ["x".repeat(281)])),
    );
    expect(long.message).toMatch(/280/);
  });

  it("ne permet pas de changer d'école, d'adresse ni de statut", async () => {
    const err = await expectSqlError(
      asUser(db.pool, ALICE, (c) => c.query("update profiles set school_id = $1 where id = $2", [LYON, ALICE])),
    );
    expect(err.code).toBe("42501");
  });

  it("enregistre les préférences de notification", async () => {
    const p = await asUser(
      db.pool,
      ALICE,
      async (c) => (await c.query("select * from update_my_preferences(true, false, true)")).rows[0],
    );
    expect([p.pref_push_enabled, p.pref_message_notifications, p.pref_email_reminders]).toEqual([true, false, true]);
  });
});

describe("Super-administrateur invité", () => {
  const ADMIN = "00000000-0000-0000-0000-0000000000ad";

  it("seul le serveur peut inviter", async () => {
    const err = await expectSqlError(
      asUser(db.pool, ALICE, (c) => c.query("select invite_platform_admin('moi@gmail.com')")),
    );
    expect(err.code).toBe("42501");
  });

  it("l'invitation autorise une adresse hors liste, crée le super-admin puis est consommée", async () => {
    await asRole(db.pool, "service_role", (c) => c.query("select invite_platform_admin(' Admin.Test@Gmail.com ')"));
    expect(await precheck("admin.test@gmail.com", "ip-admin")).toBe("ok");
    await createAuthUser(ADMIN, "admin.test@gmail.com");
    expect((await db.pool.query("select 1 from platform_admins where user_id = $1", [ADMIN])).rowCount).toBe(1);
    expect((await db.pool.query("select 1 from platform_admin_invites")).rowCount).toBe(0);
    expect(await precheck("admin.test@gmail.com", "ip-admin")).toBe("ok");
  });
});
