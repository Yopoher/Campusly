/**
 * Faux module événements pour les tests de parcours (tests/e2e). Il reproduit l'interface des fonctions SQL
 * (noms, paramètres, formes des réponses et codes d'erreur). Les règles réelles (permissions, capacité,
 * verrous, écoles) sont testées sur une vraie base dans tests/db/events.test.ts.
 */

import { randomUUID } from "node:crypto";

export const ORG_BDE = "a2000000-0000-0000-0000-000000000000";
const ORG_SCHOOL = "a1000000-0000-0000-0000-000000000000";

const orgs = {
  [ORG_BDE]: { id: ORG_BDE, name: "BDE Rouen", type: "bde", description: "Le bureau des élèves." },
  [ORG_SCHOOL]: { id: ORG_SCHOOL, name: "Ynov Rouen", type: "school", description: null },
};

/** Permissions par utilisateur (id) et organisation. */
const memberships = {
  "00000000-0000-0000-0000-00000000ca01": {
    [ORG_BDE]: ["events.create", "events.edit", "events.cancel", "events.chat"],
  },
};

const events = [];
const registrations = [];
const participantsNames = {}; // rempli par fake-supabase (id -> { first_name, last_name })

export function registerPerson(id, first_name, last_name) {
  participantsNames[id] = { first_name, last_name };
}

const now = () => Date.now();
const iso = (ms) => new Date(ms).toISOString();

/** Données de départ : un événement publié et un brouillon, pour le BDE de Rouen. */
export function resetEvents() {
  events.length = 0;
  registrations.length = 0;
  events.push({
    id: "e1000000-0000-0000-0000-00000000f001",
    organization_id: ORG_BDE,
    title: "Soirée intégration",
    description: "Pour bien commencer l’année.",
    starts_at: iso(now() + 3 * 86_400_000),
    ends_at: null,
    location: "Foyer",
    capacity: null,
    registration_deadline: null,
    external_url: null,
    status: "published",
    participants_count: 0,
    cancelled_at: null,
    cancellation_reason: null,
    created_by: "00000000-0000-0000-0000-00000000ca01",
  });
  events.push({
    id: "e1000000-0000-0000-0000-00000000f002",
    organization_id: ORG_BDE,
    title: "Brouillon BDE",
    description: "",
    starts_at: iso(now() + 9 * 86_400_000),
    ends_at: null,
    location: "Salle B12",
    capacity: null,
    registration_deadline: null,
    external_url: null,
    status: "draft",
    participants_count: 0,
    cancelled_at: null,
    cancellation_reason: null,
    created_by: "00000000-0000-0000-0000-00000000ca01",
  });
}
resetEvents();

const permsOf = (userId, orgId) => memberships[userId]?.[orgId] ?? [];
const isMember = (userId, orgId) => orgId in (memberships[userId] ?? {});

function card(e, user) {
  const org = orgs[e.organization_id];
  const endsOrStarts = Date.parse(e.ends_at ?? e.starts_at);
  const registered = registrations.some(
    (r) => r.event_id === e.id && r.user_id === user.id && r.status === "registered",
  );
  const perms = permsOf(user.id, e.organization_id);
  const deadlineOk = !e.registration_deadline || now() <= Date.parse(e.registration_deadline);
  const capacityOk = e.capacity == null || e.participants_count < e.capacity;
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    location: e.location,
    status: e.status,
    capacity: e.capacity,
    participants_count: e.participants_count,
    registration_deadline: e.registration_deadline,
    external_url: e.external_url,
    image_path: null,
    cancelled_at: e.cancelled_at,
    cancellation_reason: e.cancellation_reason,
    organization_id: e.organization_id,
    organization_name: org.name,
    organization_type: org.type,
    organization_description: org.description,
    is_past: endsOrStarts < now(),
    registered,
    registration_open: e.status === "published" && now() < Date.parse(e.starts_at) && deadlineOk && capacityOk,
    is_org_member: isMember(user.id, e.organization_id),
    can_publish: perms.includes("events.create"),
    can_edit: perms.includes("events.edit"),
    can_cancel: perms.includes("events.cancel"),
  };
}

const visibleTo = (e, user) => e.status !== "draft" || isMember(user.id, e.organization_id);

const fail = (code, message) => ({ status: 400, body: { code, message } });

function findEvent(id, user) {
  const e = events.find((x) => x.id === id);
  if (!e || !visibleTo(e, user)) return null;
  return e;
}

/**
 * Traite un appel RPC d'événements. Renvoie { status, body } ou null si la fonction n'est pas gérée ici.
 */
export function handleEventRpc(name, body, user) {
  switch (name) {
    case "my_memberships":
      return {
        status: 200,
        body: Object.entries(memberships[user.id] ?? {}).map(([orgId, perms]) => ({
          organization_id: orgId,
          organization_name: orgs[orgId].name,
          organization_type: orgs[orgId].type,
          permissions: [...perms].sort(),
        })),
      };

    case "list_events": {
      const scope = body.p_scope;
      const rows = events.map((e) => card(e, user)).filter((c) => c.status !== "draft");
      let out;
      if (scope === "upcoming") out = rows.filter((c) => !c.is_past);
      else if (scope === "mine") out = rows.filter((c) => c.registered && !c.is_past);
      else if (scope === "past") out = rows.filter((c) => c.is_past).reverse();
      else if (scope === "organization") out = rows.filter((c) => c.organization_id === body.p_org && !c.is_past);
      else return fail("22023", "Parcours inconnu");
      return { status: 200, body: out.sort((a, b) => a.starts_at.localeCompare(b.starts_at)) };
    }

    case "list_managed_events": {
      if (!isMember(user.id, body.p_org)) return fail("42501", "Permission insuffisante pour cette organisation");
      return {
        status: 200,
        body: events.filter((e) => e.organization_id === body.p_org).map((e) => card(e, user)),
      };
    }

    case "get_event": {
      const e = findEvent(body.p_event, user);
      if (!e) return fail("P0002", "Événement introuvable");
      return { status: 200, body: card(e, user) };
    }

    case "list_event_participants": {
      const e = findEvent(body.p_event, user);
      if (!e) return fail("P0002", "Événement introuvable");
      return {
        status: 200,
        body: registrations
          .filter((r) => r.event_id === e.id && r.status === "registered")
          .map((r) => ({
            user_id: r.user_id,
            first_name: participantsNames[r.user_id]?.first_name ?? "",
            last_name: participantsNames[r.user_id]?.last_name ?? "",
            avatar_path: null,
            bio: null,
            registered_at: r.registered_at,
          })),
      };
    }

    case "get_organization": {
      const org = orgs[body.p_org];
      return {
        status: 200,
        body: org ? [{ id: org.id, name: org.name, type: org.type, description: org.description }] : [],
      };
    }

    case "register_for_event": {
      const e = findEvent(body.p_event, user);
      if (!e) return fail("P0002", "Événement introuvable");
      const card_ = card(e, user);
      if (card_.registered) return { status: 200, body: card_ };
      if (e.status !== "published" || !card_.registration_open) {
        return fail("P0001", "Les inscriptions sont fermées");
      }
      if (e.capacity != null && e.participants_count >= e.capacity) return fail("P0001", "Événement complet");
      registrations.push({ event_id: e.id, user_id: user.id, status: "registered", registered_at: iso(now()) });
      e.participants_count += 1;
      return { status: 200, body: card(e, user) };
    }

    case "unregister_from_event": {
      const e = findEvent(body.p_event, user);
      if (!e) return fail("P0002", "Événement introuvable");
      const reg = registrations.find((r) => r.event_id === e.id && r.user_id === user.id && r.status === "registered");
      if (reg) {
        reg.status = "unregistered";
        e.participants_count -= 1;
      }
      return { status: 200, body: card(e, user) };
    }

    case "create_event": {
      if (!permsOf(user.id, body.p_org).includes("events.create")) {
        return fail("42501", "Permission insuffisante pour cette organisation");
      }
      if (Date.parse(body.p_starts_at) <= now()) return fail("22023", "La date de début doit être dans le futur");
      const id = randomUUID();
      events.push({
        id,
        organization_id: body.p_org,
        title: body.p_title,
        description: body.p_description ?? "",
        starts_at: body.p_starts_at,
        ends_at: body.p_ends_at,
        location: body.p_location,
        capacity: body.p_capacity,
        registration_deadline: body.p_registration_deadline,
        external_url: body.p_external_url,
        status: body.p_publish ? "published" : "draft",
        participants_count: 0,
        cancelled_at: null,
        cancellation_reason: null,
        created_by: user.id,
      });
      return { status: 200, body: id };
    }

    case "update_event": {
      const e = events.find((x) => x.id === body.p_event);
      if (!e || !visibleTo(e, user)) return fail("P0002", "Événement introuvable");
      if (!permsOf(user.id, e.organization_id).includes("events.edit")) {
        return fail("42501", "Permission insuffisante pour cette organisation");
      }
      if (e.status === "cancelled") return fail("P0001", "Un événement annulé ne peut plus être modifié");
      Object.assign(e, {
        title: body.p_title,
        description: body.p_description,
        starts_at: body.p_starts_at,
        ends_at: body.p_ends_at,
        location: body.p_location,
        capacity: body.p_capacity,
        registration_deadline: body.p_registration_deadline,
        external_url: body.p_external_url,
      });
      return { status: 200, body: null };
    }

    case "publish_event": {
      const e = events.find((x) => x.id === body.p_event);
      if (!e || !visibleTo(e, user)) return fail("P0002", "Événement introuvable");
      if (!permsOf(user.id, e.organization_id).includes("events.create")) {
        return fail("42501", "Permission insuffisante pour cette organisation");
      }
      if (e.status !== "draft") return fail("P0001", "Seul un brouillon peut être publié");
      e.status = "published";
      return { status: 200, body: null };
    }

    case "cancel_event": {
      const e = events.find((x) => x.id === body.p_event);
      if (!e || !visibleTo(e, user)) return fail("P0002", "Événement introuvable");
      if (!permsOf(user.id, e.organization_id).includes("events.cancel")) {
        return fail("42501", "Permission insuffisante pour cette organisation");
      }
      if (e.status !== "published") return fail("P0001", "Seul un événement publié peut être annulé");
      Object.assign(e, { status: "cancelled", cancelled_at: iso(now()), cancellation_reason: body.p_reason || null });
      return { status: 200, body: null };
    }

    default:
      return null;
  }
}
