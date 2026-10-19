import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Message tel qu'affiché dans la conversation. */
export type Message = {
  id: number;
  eventId: string;
  authorId: string;
  authorFirstName: string;
  authorLastName: string;
  /** Null si l'auteur poste à titre personnel, sinon le nom de l'organisation. */
  organizationName: string | null;
  organizationType: string | null;
  body: string;
  moderationStatus: "visible" | "hidden";
  createdAt: string;
};

type MessageRow = {
  id: number;
  event_id: string;
  author_id: string;
  author_first_name: string;
  author_last_name: string;
  organization_name: string | null;
  organization_type: string | null;
  body: string;
  moderation_status: "visible" | "hidden";
  created_at: string;
};

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    eventId: row.event_id,
    authorId: row.author_id,
    authorFirstName: row.author_first_name,
    authorLastName: row.author_last_name,
    organizationName: row.organization_name,
    organizationType: row.organization_type,
    body: row.body,
    moderationStatus: row.moderation_status,
    createdAt: row.created_at,
  };
}

/**
 * Messages paginés d'une conversation, chronologiques.
 * RLS (policy messages_read) filtre automatiquement selon l'accès de l'utilisateur.
 * `before` permet la pagination vers le haut (messages plus anciens).
 */
export async function listMessages(
  eventId: string,
  opts: { limit?: number; before?: number } = {},
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const limit = opts.limit ?? 50;
  const supabase = await createSupabaseServerClient();

  // Jointure profils + organisations pour afficher l'auteur et l'org.
  // La vue est sécurisée par RLS : un utilisateur sans accès ne verra rien.
  let query = supabase
    .from("messages")
    .select(
      `
      id,
      event_id,
      author_id,
      body,
      moderation_status,
      created_at,
      profiles!messages_author_id_fkey ( first_name, last_name ),
      organizations ( name, type )
    `,
    )
    .eq("event_id", eventId)
    .order("id", { ascending: true })
    .limit(limit + 1); // +1 pour savoir s'il reste des messages

  if (opts.before) {
    query = query.lt("id", opts.before);
    // Pour la pagination arrière, on veut les N plus récents avant `before`
    query = query.order("id", { ascending: false }).limit(limit + 1);
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = data ?? [];
  const hasMore = rows.length > limit;
  if (hasMore) rows = rows.slice(0, limit);

  // Si pagination arrière, rétablir l'ordre chronologique
  if (opts.before) rows.reverse();

  return {
    hasMore,
    messages: rows.map((row) => {
      const profile = row.profiles as unknown as { first_name: string; last_name: string } | null;
      const org = row.organizations as unknown as { name: string; type: string } | null;
      return toMessage({
        id: row.id,
        event_id: row.event_id,
        author_id: row.author_id,
        author_first_name: profile?.first_name ?? "?",
        author_last_name: profile?.last_name ?? "?",
        organization_name: org?.name ?? null,
        organization_type: org?.type ?? null,
        body: row.body,
        moderation_status: row.moderation_status as "visible" | "hidden",
        created_at: row.created_at,
      });
    }),
  };
}

/**
 * Vérifie si l'utilisateur a accès à la conversation d'un événement.
 * Utilise la fonction can_access_conversation en base.
 */
export async function canAccessConversation(eventId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("can_access_conversation", { p_event: eventId });
  if (error) return false;
  return data === true;
}

/**
 * Vérifie si l'utilisateur est modérateur de l'école de l'événement.
 */
export async function isModeratorForEvent(eventId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  // On récupère le school_id de l'événement et on vérifie is_school_moderator
  const { data, error } = await supabase
    .from("events")
    .select("school_id")
    .eq("id", eventId)
    .single();
  if (error || !data) return false;
  const { data: isMod } = await supabase.rpc("is_school_moderator", { p_school: data.school_id });
  return isMod === true;
}
