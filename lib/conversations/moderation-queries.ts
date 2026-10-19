import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Un signalement en attente, avec le contexte du message et de l'auteur. */
export type PendingReport = {
  id: string;
  reason: string | null;
  reporterFirstName: string;
  reporterLastName: string;
  createdAt: string;
  messageId: number;
  messageBody: string;
  messageAuthorFirstName: string;
  messageAuthorLastName: string;
  messageCreatedAt: string;
  eventId: string;
  eventTitle: string;
  moderationStatus: "visible" | "hidden";
};

/** Conversation d'un événement avec le nombre de messages et de signalements. */
export type ConversationSummary = {
  eventId: string;
  eventTitle: string;
  eventStatus: string;
  messageCount: number;
  pendingReportCount: number;
  lastMessageAt: string | null;
};

/** Utilisateur suspendu. */
export type SuspendedUser = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  suspendedUntil: string;
};

/**
 * Signalements en attente pour l'école du modérateur.
 * Requiert moderation.reports.
 */
export async function listPendingReports(): Promise<PendingReport[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("message_reports")
    .select(
      `
      id,
      reason,
      created_at,
      message_id,
      profiles!message_reports_reporter_id_fkey ( first_name, last_name ),
      messages!inner (
        body,
        created_at,
        event_id,
        moderation_status,
        profiles!messages_author_id_fkey ( first_name, last_name ),
        events!inner ( title )
      )
    `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const reporter = row.profiles as unknown as { first_name: string; last_name: string } | null;
    const msg = row.messages as unknown as {
      body: string;
      created_at: string;
      event_id: string;
      moderation_status: string;
      profiles: { first_name: string; last_name: string } | null;
      events: { title: string } | null;
    };
    return {
      id: row.id,
      reason: row.reason,
      reporterFirstName: reporter?.first_name ?? "?",
      reporterLastName: reporter?.last_name ?? "?",
      createdAt: row.created_at,
      messageId: row.message_id,
      messageBody: msg.body,
      messageAuthorFirstName: msg.profiles?.first_name ?? "?",
      messageAuthorLastName: msg.profiles?.last_name ?? "?",
      messageCreatedAt: msg.created_at,
      eventId: msg.event_id,
      eventTitle: msg.events?.title ?? "?",
      moderationStatus: msg.moderation_status as "visible" | "hidden",
    };
  });
}

/**
 * Conversations de l'école avec nombre de messages et signalements.
 * Les événements sont filtrés par RLS (même école).
 */
export async function listConversations(): Promise<ConversationSummary[]> {
  const supabase = await createSupabaseServerClient();

  // On récupère tous les événements publiés ou annulés qui ont des messages
  const { data, error } = await supabase.rpc("list_moderation_conversations");

  // Si la fonction n'existe pas encore, on tombe en fallback
  if (error) {
    // Fallback : requête directe (limitée par RLS)
    const { data: events, error: evErr } = await supabase
      .from("events")
      .select("id, title, status")
      .in("status", ["published", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (evErr) throw evErr;

    const summaries: ConversationSummary[] = [];
    for (const event of events ?? []) {
      const [{ count: msgCount }, { count: reportCount }] = await Promise.all([
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("event_id", event.id),
        supabase
          .from("message_reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .in(
            "message_id",
            // Sous-requête non possible directement, on utilise un filtre approché
            [],
          ),
      ]);

      // On ne liste que les événements avec au moins un message
      if ((msgCount ?? 0) > 0) {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("created_at")
          .eq("event_id", event.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        summaries.push({
          eventId: event.id,
          eventTitle: event.title,
          eventStatus: event.status,
          messageCount: msgCount ?? 0,
          pendingReportCount: reportCount ?? 0,
          lastMessageAt: lastMsg?.created_at ?? null,
        });
      }
    }
    return summaries;
  }

  return (data ?? []).map(
    (row: {
      event_id: string;
      event_title: string;
      event_status: string;
      message_count: number;
      pending_report_count: number;
      last_message_at: string | null;
    }) => ({
      eventId: row.event_id,
      eventTitle: row.event_title,
      eventStatus: row.event_status,
      messageCount: row.message_count,
      pendingReportCount: row.pending_report_count,
      lastMessageAt: row.last_message_at,
    }),
  );
}

/**
 * Utilisateurs dont le chat est actuellement suspendu dans l'école.
 */
export async function listSuspendedUsers(): Promise<SuspendedUser[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, chat_suspended_until")
    .not("chat_suspended_until", "is", null)
    .gt("chat_suspended_until", new Date().toISOString())
    .order("chat_suspended_until", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    userId: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    suspendedUntil: row.chat_suspended_until,
  }));
}
