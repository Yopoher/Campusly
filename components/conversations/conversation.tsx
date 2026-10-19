"use client";

import { useCallback, useEffect, useRef, useState, useActionState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendMessageAction, reportMessageAction, hideMessageAction } from "@/lib/conversations/actions";
import type { Message } from "@/lib/conversations/queries";
import type { SendMessageState, ReportMessageState, HideMessageState } from "@/lib/conversations/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";

// --- Helpers ---

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMessageDate(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** Regroupe les messages par jour pour afficher des séparateurs de date. */
function groupByDay(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const date = formatMessageDate(msg.createdAt);
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date, messages: [] });
    }
    groups.at(-1)!.messages.push(msg);
  }
  return groups;
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

// --- Composant message ---

function MessageBubble({
  message,
  currentUserId,
  isModerator,
}: {
  message: Message;
  currentUserId: string;
  isModerator: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [reportState, reportAction, reportPending] = useActionState<ReportMessageState, FormData>(
    reportMessageAction,
    {},
  );
  const [hideState, hideAction, hidePending] = useActionState<HideMessageState, FormData>(
    hideMessageAction,
    {},
  );

  const isMine = message.authorId === currentUserId;
  const isOrg = Boolean(message.organizationName);
  const isHidden = message.moderationStatus === "hidden";

  return (
    <div className="group flex flex-col gap-0.5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-[700] ${
            isOrg ? "bg-ink text-paper" : "bg-paper text-ink"
          }`}
        >
          {isOrg ? message.organizationName!.charAt(0).toUpperCase() : initials(message.authorFirstName, message.authorLastName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[0.8125rem] font-[650] text-ink">
              {isOrg
                ? `${message.organizationName} · ${message.authorFirstName}`
                : `${message.authorFirstName} ${message.authorLastName}`}
            </span>
            <span className="text-[0.75rem] text-muted">{formatMessageTime(message.createdAt)}</span>
          </div>
          {isHidden ? (
            <p className="text-[0.875rem] italic text-muted">Message masqué par la modération.</p>
          ) : (
            <p className="text-[0.875rem] leading-relaxed whitespace-pre-line text-ink">{message.body}</p>
          )}
        </div>

        {/* Bouton actions */}
        {!isMine && !isHidden && (
          <button
            type="button"
            onClick={() => setShowActions((s) => !s)}
            className="mt-1 shrink-0 rounded p-1 text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 focus:opacity-100"
            aria-label="Actions sur ce message"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="currentColor">
              <circle cx="4" cy="10" r="2" />
              <circle cx="10" cy="10" r="2" />
              <circle cx="16" cy="10" r="2" />
            </svg>
          </button>
        )}
      </div>

      {/* Menu contextuel */}
      {showActions && !isHidden && (
        <div className="ml-10 mt-1 flex flex-wrap gap-2">
          {!isMine && (
            <form action={reportAction}>
              <input type="hidden" name="messageId" value={message.id} />
              <Button type="submit" variant="ghost" size="sm" loading={reportPending} loadingLabel="Signalement…">
                {reportState.done ? "Signalé ✓" : "Signaler"}
              </Button>
            </form>
          )}
          {isModerator && (
            <form action={hideAction}>
              <input type="hidden" name="messageId" value={message.id} />
              <Button type="submit" variant="danger" size="sm" loading={hidePending} loadingLabel="Masquage…">
                {hideState.done ? "Masqué ✓" : "Masquer"}
              </Button>
            </form>
          )}
          {(reportState.error || hideState.error) && (
            <p className="text-[0.8125rem] text-danger">{reportState.error || hideState.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Composant principal ---

export function Conversation({
  eventId,
  currentUserId,
  initialMessages,
  initialHasMore,
  isModerator,
  isCancelled,
  /** ID de l'org avec permission events.chat, si applicable. */
  chatOrgId,
}: {
  eventId: string;
  currentUserId: string;
  initialMessages: Message[];
  initialHasMore: boolean;
  isModerator: boolean;
  isCancelled: boolean;
  chatOrgId?: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Envoi de message
  const [sendState, sendAction, sendPending] = useActionState<SendMessageState, FormData>(
    sendMessageAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Vider le champ après envoi réussi
  useEffect(() => {
    if (sendState.done) {
      formRef.current?.reset();
    }
  }, [sendState]);

  // Auto-scroll vers le bas quand un nouveau message arrive
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, autoScroll]);

  // Détecter si l'utilisateur a scrollé vers le haut
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(atBottom);
  }, []);

  // Temps réel : nouveaux messages et changements de modération
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`conversation:${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `event_id=eq.${eventId}` },
        (payload) => {
          // Le payload ne contient pas les jointures, on utilise les données brutes
          const row = payload.new as {
            id: number;
            event_id: string;
            author_id: string;
            organization_id: string | null;
            body: string;
            moderation_status: string;
            created_at: string;
          };
          // On ajoute le message même sans les infos profil complètes,
          // elles seront mises à jour au prochain chargement complet
          setMessages((prev) => {
            // Éviter les doublons
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                eventId: row.event_id,
                authorId: row.author_id,
                authorFirstName: "",
                authorLastName: "",
                organizationName: null,
                organizationType: null,
                body: row.body,
                moderationStatus: row.moderation_status as "visible" | "hidden",
                createdAt: row.created_at,
              },
            ];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as { id: number; moderation_status: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id ? { ...m, moderationStatus: row.moderation_status as "visible" | "hidden" } : m,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Charger les messages plus anciens
  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0].id;
      const res = await fetch(
        `/api/conversations/${eventId}/messages?before=${oldest}&limit=50`,
      );
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = (await res.json()) as { messages: Message[]; hasMore: boolean };
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [eventId, hasMore, loadingMore, messages]);

  const groups = groupByDay(messages);

  return (
    <section aria-labelledby="conversation" className="flex flex-col gap-3 border-t border-line pt-6">
      <h2 id="conversation" className="text-lg font-[700] font-narrow">
        Conversation
      </h2>

      {/* Bandeau de modération */}
      <p className="rounded-[8px] bg-surface px-3 py-2 text-[0.8125rem] text-muted">
        Cette conversation est visible par les participants et peut être modérée par l&apos;école.
      </p>

      {/* Zone des messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto"
      >
        {/* Charger plus */}
        {hasMore && (
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingMore}
            className="self-center text-[0.8125rem] font-[600] text-muted hover:text-ink disabled:opacity-50"
          >
            {loadingMore ? "Chargement…" : "Messages précédents"}
          </button>
        )}

        {messages.length === 0 && (
          <p className="py-8 text-center text-[0.9375rem] text-muted">
            {isCancelled
              ? "Aucun message dans cette conversation."
              : "Sois le premier à écrire dans cette conversation !"}
          </p>
        )}

        {groups.map((group) => (
          <div key={group.date} className="flex flex-col gap-3">
            <p className="self-center rounded-full bg-surface px-3 py-0.5 text-[0.75rem] font-[600] text-muted">
              {group.date}
            </p>
            {group.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                currentUserId={currentUserId}
                isModerator={isModerator}
              />
            ))}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Formulaire d'envoi */}
      {!isCancelled && (
        <form ref={formRef} action={sendAction} className="flex gap-2">
          <input type="hidden" name="eventId" value={eventId} />
          {chatOrgId && <input type="hidden" name="organizationId" value={chatOrgId} />}
          <label className="sr-only" htmlFor="message-body">
            Ton message
          </label>
          <input
            id="message-body"
            name="body"
            type="text"
            required
            maxLength={2000}
            placeholder="Écris un message…"
            autoComplete="off"
            className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[0.9375rem] text-ink placeholder:text-muted focus:border-ink focus:outline-none"
          />
          <Button type="submit" size="sm" loading={sendPending} loadingLabel="Envoi…">
            Envoyer
          </Button>
        </form>
      )}
      {isCancelled && (
        <Notice tone="info" title="Conversation en lecture seule">
          L&apos;événement est annulé, il n&apos;est plus possible d&apos;envoyer des messages.
        </Notice>
      )}
      {sendState.error && <Notice tone="error" title={sendState.error} />}
    </section>
  );
}
