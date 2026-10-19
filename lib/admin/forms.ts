import { z } from "zod";

/** Types d'organisation créables depuis le back-office (l'organisation « École » est créée avec l'école). */
export const ORG_TYPES = [
  { value: "bde", label: "BDE" },
  { value: "direction", label: "Direction" },
  { value: "pedagogy", label: "Pédagogie" },
  { value: "association", label: "Association" },
  { value: "other", label: "Autre" },
] as const;

/** Permissions d'événements attribuables à un membre d'organisation. */
export const EVENT_PERMISSIONS = [
  { value: "events.create", label: "Créer et publier des événements" },
  { value: "events.edit", label: "Modifier des événements" },
  { value: "events.cancel", label: "Annuler des événements" },
  { value: "events.view_participants", label: "Voir la liste des inscrits" },
  { value: "events.chat", label: "Écrire au nom de l’organisation" },
] as const;

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export const schoolSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(120, "Nom trop long"),
  slug: z
    .string()
    .min(2, "L’identifiant doit contenir au moins 2 caractères")
    .max(60, "Identifiant trop long")
    .regex(SLUG, "Identifiant : lettres minuscules, chiffres et tirets uniquement"),
  domains: z.array(z.string()).min(1, "Indique au moins un domaine e-mail"),
  timezone: z.string().refine(isTimezone, "Fuseau horaire inconnu"),
});

export function parseSchoolForm(form: FormData) {
  const domains = text(form, "domains")
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter(Boolean);
  const invalid = domains.find((d) => !DOMAIN.test(d));
  const parsed = schoolSchema.safeParse({
    name: text(form, "name"),
    slug: text(form, "slug").toLowerCase(),
    domains: invalid ? [] : domains,
    timezone: text(form, "timezone") || "Europe/Paris",
  });
  if (invalid) return { ok: false as const, error: `Domaine invalide : ${invalid}` };
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  return { ok: true as const, values: parsed.data };
}

export const organizationSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(120, "Nom trop long"),
  type: z.enum(ORG_TYPES.map((t) => t.value)),
  description: z.string().max(500, "Description trop longue"),
});

export function parseOrganizationForm(form: FormData) {
  const parsed = organizationSchema.safeParse({
    name: text(form, "name"),
    type: text(form, "type"),
    description: text(form, "description"),
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  return { ok: true as const, values: parsed.data };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const PERMISSION_VALUES: string[] = EVENT_PERMISSIONS.map((p) => p.value);

export function parseMemberForm(form: FormData) {
  const email = text(form, "email").toLowerCase();
  if (!EMAIL.test(email)) return { ok: false as const, error: "Adresse e-mail invalide" };
  const permissions = form
    .getAll("permissions")
    .map(String)
    .filter((p) => PERMISSION_VALUES.includes(p));
  return { ok: true as const, values: { email, permissions } };
}
