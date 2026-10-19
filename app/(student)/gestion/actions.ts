"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseEventForm, type EventFormErrors } from "@/lib/events/form";
import { messageForDatabaseError } from "@/lib/events/model";

/** État renvoyé au formulaire : erreurs par champ et valeurs saisies à conserver. */
export type EventFormState = {
  error?: string;
  errors?: EventFormErrors;
  values?: Record<string, string | boolean>;
  done?: "updated" | "published";
};

/** État renvoyé aux boutons de publication et d'annulation. */
export type EventActionState = { error?: string; done?: "published" | "cancelled" };

const eventId = z.guid();

function refreshEventPages(id?: string) {
  revalidatePath("/gestion", "layout");
  revalidatePath("/evenements", "layout");
  if (id) revalidatePath(`/evenements/${id}`);
}

/** Création d'un événement au nom d'une organisation (permission events.create contrôlée en base). */
export async function createEventAction(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const parsed = parseEventForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values, error: "Corrige les champs signalés." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_event", parsed.rpc);
  if (error) return { error: messageForDatabaseError(error), values: parsed.values };

  refreshEventPages();
  redirect(`/gestion?org=${parsed.rpc.p_org}${parsed.rpc.p_publish ? "&publie=1" : "&brouillon=1"}`);
}

/**
 * Modification. Si « publier » est demandé sur un brouillon, la publication suit la mise à jour.
 * Les deux appels se suivent : en cas d'échec de la publication, les modifications restent enregistrées.
 */
export async function updateEventAction(
  id: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  if (!eventId.safeParse(id).success) return { error: "Événement introuvable." };
  const parsed = parseEventForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values, error: "Corrige les champs signalés." };
  const v = parsed.rpc;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_event", {
    p_event: id,
    p_title: v.p_title,
    p_description: v.p_description,
    p_starts_at: v.p_starts_at,
    p_ends_at: v.p_ends_at,
    p_location: v.p_location,
    p_capacity: v.p_capacity,
    p_registration_deadline: v.p_registration_deadline,
    p_external_url: v.p_external_url,
  });
  if (error) return { error: messageForDatabaseError(error), values: parsed.values };

  if (v.p_publish) {
    const { error: publishError } = await supabase.rpc("publish_event", { p_event: id });
    refreshEventPages(id);
    if (publishError) {
      return {
        error: `Tes modifications sont enregistrées, mais la publication n’a pas abouti. ${messageForDatabaseError(publishError)}`,
        values: parsed.values,
      };
    }
    return { done: "published" };
  }

  refreshEventPages(id);
  return { done: "updated" };
}

export async function publishEventAction(id: string): Promise<EventActionState> {
  if (!eventId.safeParse(id).success) return { error: "Événement introuvable." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("publish_event", { p_event: id });
  if (error) return { error: messageForDatabaseError(error) };
  refreshEventPages(id);
  return { done: "published" };
}

export async function cancelEventAction(
  id: string,
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  if (!eventId.safeParse(id).success) return { error: "Événement introuvable." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length > 500) return { error: "Le motif ne doit pas dépasser 500 caractères." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_event", { p_event: id, p_reason: reason });
  if (error) return { error: messageForDatabaseError(error) };
  refreshEventPages(id);
  return { done: "cancelled" };
}
