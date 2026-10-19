import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EVENT_IMAGE_BUCKET, EVENT_IMAGE_URL_SECONDS } from "./image";
import { toEventCard, type EventCard, type EventRow } from "./model";

/**
 * Lectures du module événements. Toutes passent par des fonctions ou la vue event_cards,
 * exécutées au nom de l'utilisateur : les règles d'accès sont celles de la base.
 */

export type Membership = {
  organization_id: string;
  organization_name: string;
  organization_type: string;
  permissions: string[];
};

export type Participant = {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_path: string | null;
  bio: string | null;
  registered_at: string;
};

export type Organization = { id: string; name: string; type: string; description: string | null };

export async function listEvents(scope: "upcoming" | "mine" | "past"): Promise<EventCard[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_events", { p_scope: scope });
  if (error) throw error;
  return (data as EventRow[]).map(toEventCard);
}

export async function listOrganizationEvents(organizationId: string): Promise<EventCard[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_events", { p_scope: "organization", p_org: organizationId });
  if (error) throw error;
  return (data as EventRow[]).map(toEventCard);
}

/** Renvoie null si l'événement n'existe pas ou n'est pas accessible à l'utilisateur. */
export async function getEvent(id: string): Promise<EventCard | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_event", { p_event: id });
  if (error) {
    if (error.code === "P0002") return null;
    throw error;
  }
  return data?.id ? toEventCard(data as EventRow) : null;
}

export async function listManagedEvents(organizationId: string): Promise<EventCard[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_managed_events", { p_org: organizationId });
  if (error) throw error;
  return (data as EventRow[]).map(toEventCard);
}

export async function listParticipants(eventId: string): Promise<Participant[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_event_participants", { p_event: eventId });
  if (error) throw error;
  return data as Participant[];
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_organization", { p_org: id });
  if (error) throw error;
  return (data as Organization[])[0] ?? null;
}

export async function listMemberships(): Promise<Membership[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_memberships");
  if (error) throw error;
  return data as Membership[];
}

/**
 * Lien temporaire vers l'image d'un événement. Le stockage applique ses règles à l'appelant :
 * sans accès à l'événement, aucun lien n'est produit. Renvoie null si l'image n'est pas accessible.
 */
export async function getEventImageUrl(path: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(EVENT_IMAGE_BUCKET)
    .createSignedUrl(path, EVENT_IMAGE_URL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}
