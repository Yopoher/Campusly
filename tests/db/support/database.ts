import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";

/**
 * Base de test jetable : chaque fichier de test crée sa propre base,
 * y applique la couche de compatibilité Supabase puis toutes les migrations,
 * et la supprime à la fin. Aucune donnée réelle n'est jamais utilisée.
 *
 * TEST_DATABASE_URL doit pointer vers une base d'administration d'un serveur
 * PostgreSQL 16+ (par défaut : postgres://postgres@127.0.0.1:5432/postgres).
 */
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5432/postgres";
const ROOT = join(import.meta.dirname, "..", "..", "..");

export type TestDb = {
  pool: pg.Pool;
  url: string;
  drop: () => Promise<void>;
};

function withDatabase(url: string, database: string) {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

export async function createTestDatabase(): Promise<TestDb> {
  const name = `campusly_test_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = withDatabase(ADMIN_URL, name);
  const setup = new pg.Client({ connectionString: url });
  await setup.connect();
  const { rows } = await setup.query("select 1 from pg_namespace where nspname = 'auth'");
  if (rows.length === 0) {
    await setup.query(readFileSync(join(ROOT, "supabase/tests/support/auth_shim.sql"), "utf8"));
  }
  const migrationsDir = join(ROOT, "supabase/migrations");
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await setup.query(readFileSync(join(migrationsDir, file), "utf8"));
  }
  await setup.end();

  const pool = new pg.Pool({ connectionString: url, max: 25 });
  let dropping = false;
  // Une connexion inactive coupée par la suppression de la base pendant le nettoyage est attendue ;
  // toute autre erreur de connexion reste remontée.
  pool.on("error", (error: Error & { code?: string }) => {
    if (dropping && error.code === "57P01") return;
    throw error;
  });
  return {
    pool,
    url,
    drop: async () => {
      dropping = true;
      await pool.end();
      const a = new pg.Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

/**
 * Exécute `fn` comme un utilisateur connecté (rôle `authenticated`, auth.uid() = userId),
 * dans une transaction validée en cas de succès et annulée en cas d'erreur.
 */
export async function asUser<T>(
  pool: pg.Pool,
  userId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
  options: { aal?: "aal1" | "aal2" } = {},
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated", aal: options.aal ?? "aal1" }),
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Exécute `fn` sous un rôle technique : `service_role` (serveur) ou `supabase_auth_admin` (service Auth). */
export async function asRole<T>(
  pool: pg.Pool,
  role: "service_role" | "supabase_auth_admin" | "anon",
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Renvoie le code SQLSTATE et le message d'une erreur attendue. */
export async function expectSqlError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; message?: string };
    return { code: e.code, message: e.message };
  }
  throw new Error("Une erreur SQL était attendue, mais l'opération a réussi");
}
