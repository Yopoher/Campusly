import { z } from "zod";
import { zonedLocalToUtc } from "./time";

/**
 * Validation du formulaire d'événement (création et modification).
 * Le serveur revalide tout en base (permissions, dates, capacité) : ce module n'est qu'un premier contrôle
 * qui produit des messages clairs pour l'utilisateur.
 */

const text = (max: number, message: string) => z.string().trim().max(max, message);

export const eventFormSchema = z
  .object({
    organization_id: z.guid({ error: "Choisis l’organisation au nom de laquelle publier" }),
    title: z
      .string({ error: "Donne un titre à l’événement" })
      .trim()
      .min(3, "Le titre doit contenir au moins 3 caractères")
      .max(120, "Le titre ne doit pas dépasser 120 caractères"),
    description: text(5000, "La description ne doit pas dépasser 5 000 caractères"),
    starts_at: z.string().min(1, "Indique la date et l’heure de début"),
    ends_at: z.string(),
    location: z
      .string({ error: "Indique le lieu" })
      .trim()
      .min(2, "Le lieu doit contenir au moins 2 caractères")
      .max(200, "Le lieu ne doit pas dépasser 200 caractères"),
    capacity: z.string(),
    registration_deadline: z.string(),
    external_url: z.string().trim().max(500),
    publish: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const start = zonedLocalToUtc(value.starts_at);
    if (!start) {
      ctx.addIssue({ code: "custom", path: ["starts_at"], message: "Cette date de début n’est pas valide" });
      return;
    }
    if (start.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", path: ["starts_at"], message: "La date de début doit être dans le futur" });
    }

    if (value.ends_at) {
      const end = zonedLocalToUtc(value.ends_at);
      if (!end) ctx.addIssue({ code: "custom", path: ["ends_at"], message: "Cette heure de fin n’est pas valide" });
      else if (end.getTime() <= start.getTime()) {
        ctx.addIssue({ code: "custom", path: ["ends_at"], message: "La fin doit être après le début" });
      }
    }

    if (value.registration_deadline) {
      const deadline = zonedLocalToUtc(value.registration_deadline);
      if (!deadline) {
        ctx.addIssue({
          code: "custom",
          path: ["registration_deadline"],
          message: "Cette date limite n’est pas valide",
        });
      } else if (deadline.getTime() > start.getTime()) {
        ctx.addIssue({
          code: "custom",
          path: ["registration_deadline"],
          message: "La date limite d’inscription doit être avant le début",
        });
      }
    }

    if (value.capacity) {
      const capacity = Number(value.capacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100_000) {
        ctx.addIssue({
          code: "custom",
          path: ["capacity"],
          message: "Indique un nombre de places entier, supérieur à 0",
        });
      }
    }

    if (value.external_url && !/^https:\/\/\S+$/.test(value.external_url)) {
      ctx.addIssue({ code: "custom", path: ["external_url"], message: "Le lien doit commencer par https://" });
    }
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;
export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>;

/** Lit un formulaire HTML et renvoie soit les données prêtes pour la base, soit les erreurs par champ. */
export function parseEventForm(formData: FormData) {
  const raw = {
    organization_id: String(formData.get("organization_id") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    starts_at: String(formData.get("starts_at") ?? ""),
    ends_at: String(formData.get("ends_at") ?? ""),
    location: String(formData.get("location") ?? ""),
    capacity: String(formData.get("capacity") ?? ""),
    registration_deadline: String(formData.get("registration_deadline") ?? ""),
    external_url: String(formData.get("external_url") ?? ""),
    publish: formData.get("publish") === "1",
  };

  const result = eventFormSchema.safeParse(raw);
  if (!result.success) {
    const errors: EventFormErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof EventFormValues | undefined;
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false as const, errors, values: raw };
  }

  const v = result.data;
  const startsAt = zonedLocalToUtc(v.starts_at)!;
  const endsAt = v.ends_at ? zonedLocalToUtc(v.ends_at) : null;
  const deadline = v.registration_deadline ? zonedLocalToUtc(v.registration_deadline) : null;

  return {
    ok: true as const,
    values: raw,
    rpc: {
      p_org: v.organization_id,
      p_title: v.title,
      p_description: v.description,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt?.toISOString() ?? null,
      p_location: v.location,
      p_capacity: v.capacity ? Number(v.capacity) : null,
      p_registration_deadline: deadline?.toISOString() ?? null,
      p_external_url: v.external_url || null,
      p_publish: v.publish,
    },
  };
}
