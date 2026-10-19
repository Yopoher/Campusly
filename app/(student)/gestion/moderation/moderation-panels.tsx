"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import {
  handleReportAction,
  suspendChatAction,
  unsuspendChatAction,
  type ModerationActionState,
} from "@/lib/conversations/moderation-actions";
import { hideMessageAction, type HideMessageState } from "@/lib/conversations/actions";

/**
 * Actions sur un signalement : masquer le message et/ou clore le signalement.
 */
export function ReportActions({
  reportId,
  messageId,
  isHidden,
}: {
  reportId: string;
  messageId: number;
  isHidden: boolean;
}) {
  const [resolveState, resolveAction, resolvePending] = useActionState<ModerationActionState, FormData>(
    handleReportAction,
    {},
  );
  const [dismissState, dismissAction, dismissPending] = useActionState<ModerationActionState, FormData>(
    handleReportAction,
    {},
  );
  const [hideState, hideAction, hidePending] = useActionState<HideMessageState, FormData>(
    hideMessageAction,
    {},
  );

  if (resolveState.done || dismissState.done) {
    return <Notice tone="success" title="Signalement traité." />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {!isHidden && !hideState.done && (
          <form action={hideAction}>
            <input type="hidden" name="messageId" value={messageId} />
            <Button type="submit" variant="danger" size="sm" loading={hidePending} loadingLabel="Masquage…">
              Masquer le message
            </Button>
          </form>
        )}
        {hideState.done && <Notice tone="success" title="Message masqué." />}

        <form action={resolveAction}>
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="action" value="resolved" />
          <Button type="submit" variant="primary" size="sm" loading={resolvePending} loadingLabel="Traitement…">
            Clore (résolu)
          </Button>
        </form>

        <form action={dismissAction}>
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="action" value="dismissed" />
          <Button type="submit" variant="secondary" size="sm" loading={dismissPending} loadingLabel="Traitement…">
            Rejeter
          </Button>
        </form>
      </div>

      {(resolveState.error || dismissState.error || hideState.error) && (
        <Notice tone="error" title={resolveState.error || dismissState.error || hideState.error || ""} />
      )}
    </div>
  );
}

/**
 * Formulaire de suspension d'un utilisateur par son adresse e-mail.
 */
export function SuspendForm() {
  const [state, action, pending] = useActionState<ModerationActionState, FormData>(suspendChatAction, {});
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
        Suspendre un utilisateur
      </Button>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <p className="mb-3 text-[0.9375rem] font-[650] text-ink">Suspendre le chat d&apos;un utilisateur</p>
      {state.done && <Notice tone="success" title="Utilisateur suspendu." />}
      {state.error && <Notice tone="error" title={state.error} />}
      {!state.done && (
        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[0.8125rem] font-[600] text-muted">Identifiant de l&apos;utilisateur (UUID)</span>
            <input
              name="userId"
              type="text"
              required
              pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="min-h-10 rounded-[var(--radius-control)] border border-line bg-paper px-3 text-[0.875rem] text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.8125rem] font-[600] text-muted">Durée (heures)</span>
            <input
              name="hours"
              type="number"
              required
              min={1}
              max={720}
              defaultValue={24}
              className="min-h-10 w-32 rounded-[var(--radius-control)] border border-line bg-paper px-3 text-[0.875rem] text-ink focus:border-ink focus:outline-none"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm" loading={pending} loadingLabel="Suspension…">
              Suspendre
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Bouton de levée de suspension.
 */
export function UnsuspendButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<ModerationActionState, FormData>(unsuspendChatAction, {});

  if (state.done) {
    return <span className="text-[0.8125rem] text-success font-[600]">Levée ✓</span>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="secondary" size="sm" loading={pending} loadingLabel="Levée…">
        Lever
      </Button>
      {state.error && <p className="text-[0.8125rem] text-danger">{state.error}</p>}
    </form>
  );
}
