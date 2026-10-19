import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { listMemberships } from "@/lib/events/queries";
import { listPendingReports, listSuspendedUsers } from "@/lib/conversations/moderation-queries";
import { formatLongDate, formatTime } from "@/lib/format";
import { ReportActions, SuspendForm, UnsuspendButton } from "./moderation-panels";

export const metadata: Metadata = { title: "Modération" };

async function ModerationContent() {
  await requireStudent("/gestion/moderation");
  const memberships = await listMemberships();

  // Vérifier que l'utilisateur a au moins une permission de modération
  const moderationPerms = ["moderation.conversations", "moderation.reports", "moderation.suspend_chat"];
  const hasModerationAccess = memberships.some((m) =>
    m.permissions.some((p) => moderationPerms.includes(p)),
  );

  if (!hasModerationAccess) {
    return (
      <EmptyState title="Accès restreint">
        Tu n&apos;as pas de permission de modération. Cette section est réservée aux membres habilités de
        l&apos;organisation École.
      </EmptyState>
    );
  }

  const canViewReports = memberships.some((m) => m.permissions.includes("moderation.reports"));
  const canSuspend = memberships.some((m) => m.permissions.includes("moderation.suspend_chat"));

  const [reports, suspendedUsers] = await Promise.all([
    canViewReports ? listPendingReports() : Promise.resolve([]),
    canSuspend ? listSuspendedUsers() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Signalements en attente */}
      {canViewReports && (
        <section aria-labelledby="reports" className="flex flex-col gap-4">
          <h2 id="reports" className="text-lg font-[700] font-narrow">
            Signalements en attente · {reports.length}
          </h2>

          {reports.length === 0 ? (
            <p className="text-[0.9375rem] text-muted">Aucun signalement en attente.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {reports.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-[0.8125rem] text-muted">
                      Signalé par {report.reporterFirstName} {report.reporterLastName} ·{" "}
                      {formatLongDate(new Date(report.createdAt))} à {formatTime(new Date(report.createdAt))}
                    </p>
                    {report.reason && (
                      <p className="text-[0.875rem] text-ink">
                        Motif : {report.reason}
                      </p>
                    )}
                  </div>

                  <div className="rounded-[8px] border border-line bg-paper p-3">
                    <p className="text-[0.8125rem] font-[650] text-ink">
                      {report.messageAuthorFirstName} {report.messageAuthorLastName}
                      <span className="ml-2 font-normal text-muted">
                        {formatTime(new Date(report.messageCreatedAt))}
                      </span>
                    </p>
                    {report.moderationStatus === "hidden" ? (
                      <p className="text-[0.875rem] italic text-muted">Message masqué par la modération.</p>
                    ) : (
                      <p className="text-[0.875rem] leading-relaxed whitespace-pre-line text-ink">
                        {report.messageBody}
                      </p>
                    )}
                    <p className="mt-1 text-[0.75rem] text-muted">
                      Dans :{" "}
                      <Link href={`/evenements/${report.eventId}`} className="underline underline-offset-2">
                        {report.eventTitle}
                      </Link>
                    </p>
                  </div>

                  <ReportActions
                    reportId={report.id}
                    messageId={report.messageId}
                    isHidden={report.moderationStatus === "hidden"}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Suspensions */}
      {canSuspend && (
        <section aria-labelledby="suspensions" className="flex flex-col gap-4">
          <h2 id="suspensions" className="text-lg font-[700] font-narrow">
            Suspensions de chat actives · {suspendedUsers.length}
          </h2>

          {suspendedUsers.length === 0 ? (
            <p className="text-[0.9375rem] text-muted">Aucun utilisateur suspendu actuellement.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {suspendedUsers.map((u) => (
                <li
                  key={u.userId}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3"
                >
                  <div>
                    <p className="font-[650] text-ink">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-[0.8125rem] text-muted">
                      Suspendu jusqu&apos;au {formatLongDate(new Date(u.suspendedUntil))} à{" "}
                      {formatTime(new Date(u.suspendedUntil))}
                    </p>
                  </div>
                  <UnsuspendButton userId={u.userId} />
                </li>
              ))}
            </ul>
          )}

          <SuspendForm />
        </section>
      )}

      <p className="text-sm text-muted">
        <Link href="/gestion" className="underline underline-offset-4">
          Retour à la gestion
        </Link>
      </p>
    </div>
  );
}

export default function ModerationPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Modération</h1>
      <Suspense fallback={<p className="text-muted">Chargement de l&apos;espace de modération…</p>}>
        <ModerationContent />
      </Suspense>
    </div>
  );
}
