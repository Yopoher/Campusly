"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseEventForm, type EventFormErrors } from "@/lib/events/form";
import { EVENT_IMAGE_BUCKET, processEventImage } from "@/lib/events/image";
import { messageForDatabaseError } from "@/lib/events/model";

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

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

  // L'image est contrôlée avant la création : un fichier refusé ne crée pas d'événement.
  const image = await readImage(formData.get("image"));
  if (image && !image.ok) return { error: image.message, values: parsed.values };

  const supabase = await createSupabaseServerClient();
  const { data: eventId, error } = await supabase.rpc("create_event", parsed.rpc);
  if (error) return { error: messageForDatabaseError(error), values: parsed.values };

  // L'événement existe déjà : si l'envoi de l'image échoue, on ouvre la modification pour la reprendre.
  if (image?.ok && typeof eventId === "string") {
    const imageError = await storeEventImage(supabase, eventId, image.data);
    if (imageError) {
      refreshEventPages(eventId);
      redirect(`/gestion/evenements/${eventId}?image=echec`);
    }
  }

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

/** État renvoyé au formulaire d'image. */
export type EventImageState = { error?: string; done?: "uploaded" | "removed" };

/** Lit le fichier d'image du formulaire et le ré-encode. Renvoie null si aucun fichier n'est joint. */
async function readImage(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return null;
  return processEventImage(Buffer.from(await value.arrayBuffer()));
}

/**
 * Envoie une image déjà traitée puis l'enregistre sur l'événement.
 * Le stockage applique ses règles à l'utilisateur (école, permission, format du chemin) ;
 * set_event_image enregistre le chemin et l'audit. En cas d'échec, l'objet envoyé est supprimé.
 * Renvoie un message d'erreur, ou null si tout a réussi.
 */
async function storeEventImage(supabase: SupabaseServer, eventId: string, data: Buffer): Promise<string | null> {
  const { data: event, error: readError } = await supabase
    .from("event_cards")
    .select("school_id")
    .eq("id", eventId)
    .maybeSingle<{ school_id: string }>();
  if (readError) return messageForDatabaseError(readError);
  if (!event) return "Événement introuvable.";

  const path = `${event.school_id}/${eventId}/${randomUUID()}.webp`;
  const bucket = supabase.storage.from(EVENT_IMAGE_BUCKET);
  const { error: uploadError } = await bucket.upload(path, data, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) return "L’image n’a pas pu être envoyée. Réessaie.";

  const { data: previous, error: setError } = await supabase.rpc("set_event_image", {
    p_event: eventId,
    p_path: path,
  });
  if (setError) {
    await bucket.remove([path]);
    return messageForDatabaseError(setError);
  }
  if (typeof previous === "string") await bucket.remove([previous]);
  return null;
}

/**
 * Ajout ou remplacement de l'image d'un événement existant.
 */
export async function uploadEventImageAction(
  id: string,
  _prev: EventImageState,
  formData: FormData,
): Promise<EventImageState> {
  if (!eventId.safeParse(id).success) return { error: "Événement introuvable." };
  const image = await readImage(formData.get("image"));
  if (!image) return { error: "Choisis une image à envoyer." };
  if (!image.ok) return { error: image.message };

  const supabase = await createSupabaseServerClient();
  const error = await storeEventImage(supabase, id, image.data);
  if (error) return { error };

  refreshEventPages(id);
  return { done: "uploaded" };
}

/** Retrait de l'image : le chemin est effacé en base, puis l'objet est supprimé. */
export async function removeEventImageAction(id: string): Promise<EventImageState> {
  if (!eventId.safeParse(id).success) return { error: "Événement introuvable." };
  const supabase = await createSupabaseServerClient();
  const { data: previous, error } = await supabase.rpc("set_event_image", { p_event: id, p_path: null });
  if (error) return { error: messageForDatabaseError(error) };
  if (typeof previous === "string") await supabase.storage.from(EVENT_IMAGE_BUCKET).remove([previous]);

  refreshEventPages(id);
  return { done: "removed" };
}
