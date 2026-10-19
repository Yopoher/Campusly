/**
 * Faux Supabase pour les tests de parcours : reproduit uniquement les points d'API utilisés par la connexion
 * (Auth : envoi et vérification du code, utilisateur, déconnexion ; PostgREST : fonctions appelées).
 * Les règles d'accès réelles sont testées sur une vraie base dans tests/db/ ; ici on teste l'interface.
 *
 * Comptes fictifs :
 *  - alice.test@ynov.com : profil complet -> arrive sur /evenements
 *  - nouveau.<suffixe>.test@ynov.com : prénom et nom vides -> passe par /bienvenue
 *    (un suffixe par test, car les tests s'exécutent en parallèle)
 *  - toute autre adresse : non autorisée (même réponse neutre côté interface)
 * Code valide : 123456 ; code 000000 : expiré.
 */
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { handleEventRpc, registerPerson } from "./fake-events.mjs";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54400);

/**
 * Comptes des parcours d'événements :
 *  - carla.test@ynov.com : responsable BDE (publie, modifie, annule)
 *  - alice.test@ynov.com, bob.test@ynov.com : étudiants (découvrent, s'inscrivent)
 */
const users = {
  "alice.test@ynov.com": { id: "00000000-0000-0000-0000-00000000a11c", first_name: "Alice", last_name: "Martin" },
  "bob.test@ynov.com": { id: "00000000-0000-0000-0000-00000000b0b1", first_name: "Bob", last_name: "Leroy" },
  "carla.test@ynov.com": { id: "00000000-0000-0000-0000-00000000ca01", first_name: "Carla", last_name: "Durand" },
};
for (const u of Object.values(users)) registerPerson(u.id, u.first_name, u.last_name);
const byId = Object.fromEntries(Object.entries(users).map(([email, u]) => [u.id, { ...u, email }]));

/** Les adresses nouveau.<suffixe>.test@ynov.com sont autorisées et créées à la volée, sans nom. */
function lookup(email) {
  if (!users[email] && /^nouveau\.[a-z0-9-]+\.test@ynov\.com$/.test(email)) {
    const h = createHash("sha256").update(email).digest("hex");
    const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
    users[email] = { id, first_name: "", last_name: "" };
    byId[id] = { ...users[email], email };
  }
  return users[email];
}
const sentCodes = new Set();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (u) =>
  `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: u.id,
    email: u.email,
    role: "authenticated",
    aud: "authenticated",
    aal: "aal1",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.${Buffer.alloc(32, 7).toString("base64url")}`; // signature factice, au bon format

const authUser = (u) => ({
  id: u.id,
  email: u.email,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-10-15T00:00:00Z",
});

function currentUser(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return byId[payload.sub] ?? null;
  } catch {
    return null;
  }
}

const profileOf = (u) => ({
  id: u.id,
  school_id: "a0000000-0000-0000-0000-000000000000",
  email: u.email,
  person_type: "student",
  first_name: u.first_name,
  last_name: u.last_name,
  bio: null,
  status: "active",
  pref_push_enabled: true,
  pref_message_notifications: true,
  pref_email_reminders: true,
  onboarding_completed_at: null,
});

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const path = new URL(req.url, "http://x").pathname;
  if (process.env.FAKE_SUPABASE_LOG) console.log(req.method, path, req.headers.authorization ? "(auth)" : "");

  switch (`${req.method} ${path}`) {
    case "GET /auth/v1/health":
      return send(res, 200, { status: "ok" });
    case "POST /rest/v1/rpc/login_precheck":
      return send(res, 200, lookup(body.p_email) ? "ok" : "denied");
    case "POST /auth/v1/otp":
      sentCodes.add(body.email);
      return send(res, 200, {});
    case "POST /auth/v1/verify": {
      const u = lookup(body.email);
      if (!u || !sentCodes.has(body.email) || body.token !== "123456") {
        return send(res, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      }
      const user = { ...u, email: body.email };
      return send(res, 200, {
        access_token: jwt(user),
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `refresh-${user.id}`,
        user: authUser(user),
      });
    }
    case "GET /auth/v1/user": {
      const u = currentUser(req);
      return u ? send(res, 200, authUser(u)) : send(res, 401, { code: 401, msg: "invalid JWT" });
    }
    case "POST /auth/v1/logout":
      return send(res, 204);
    case "POST /rest/v1/rpc/get_my_profile": {
      const u = currentUser(req);
      return u ? send(res, 200, profileOf(u)) : send(res, 200, null);
    }
    case "POST /rest/v1/rpc/is_platform_admin":
      return send(res, 200, false);
    case "POST /rest/v1/rpc/update_my_profile": {
      const u = currentUser(req);
      if (!u) return send(res, 401, { code: "42501", message: "Compte inactif" });
      if (!String(body.p_first_name ?? "").trim()) {
        return send(res, 400, { code: "22023", message: "Le prénom doit contenir entre 1 et 60 caractères" });
      }
      const stored = users[u.email];
      stored.first_name = body.p_first_name.trim();
      stored.last_name = String(body.p_last_name ?? "").trim();
      byId[u.id] = { ...stored, email: u.email };
      return send(res, 200, profileOf(byId[u.id]));
    }
    default: {
      const rpc = path.match(/^\/rest\/v1\/rpc\/(\w+)$/);
      const user = rpc ? currentUser(req) : null;
      const handled = user ? handleEventRpc(rpc[1], body, user) : null;
      if (handled) return send(res, handled.status, handled.body);
      return send(res, 404, { message: `Non simulé : ${req.method} ${path}` });
    }
  }
}).listen(PORT, "127.0.0.1", () => console.log(`faux Supabase sur ${PORT}`));
