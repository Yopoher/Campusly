import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatLongDate, formatTimeRange } from "@/lib/format";
import { requireStudent } from "@/lib/auth/session";
import { type EventCard, ORG_TYPE_LABEL } from "@/lib/events/model";
import { listManagedEvents, listMemberships, type Membership } from "@/lib/events/queries";
import type { OrgType } from "@/components/events/org-badge";

export const metadata: Metadata = { title: "Gestion des événements" };

const canManage = (m: Membership) => m.permissions.some((p) => p.startsWith("events."));
const canModerate = (m: Membership) => m.permissions.some((p) => p.startsWith("moderation."));

function statusLabel(event: EventCard) {
  if (event.status === "draft") return { label: "Brouillon", className: "bg-paper text-ink" };
  if (event.status === "cancelled") return { label: "Annulé", className: "bg-danger-soft text-danger" };
  if (event.isPast) return { label: "Terminé", className: "bg-paper text-muted" };
  return { label: "Publié", className: "bg-marker text-marker-ink" };
}

async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; publie?: string; brouillon?: string }>;
}) {
  const { org, publie, brouillon } = await searchParams;
  await requireStudent("/gestion");

  const memberships = (await listMemberships()).filter(canManage);
  if (memberships.length === 0) {
    return (
      <EmptyState title="Aucun espace de gestion">
        Tu n’as pas de rôle permettant de gérer les événements d’une organisation. Demande-le au bureau de ton
        organisation ou à la direction de l’école.
      </EmptyState>
    );
  }

  const current = memberships.find((m) => m.organization_id === org) ?? memberships[0];
  const events = await listManagedEvents(current.organization_id);
  const upcoming = events.filter((e) => e.status === "published" && !e.isPast);
  const drafts = events.filter((e) => e.status === "draft");
  const registrations = upcoming.reduce((sum, e) => sum + e.participantsCount, 0);
  const canCreate = current.permissions.includes("events.create");

  return (
    <div className="flex flex-col gap-6">
      {publie === "1" && <Notice tone="success" title="Événement publié" />}
      {brouillon === "1" && <Notice tone="success" title="Brouillon enregistré" />}

      {memberships.length > 1 && (
        <nav aria-label="Choisir l’organisation" className="flex flex-wrap gap-2">
          {memberships.map((m) => (
            <Link
              key={m.organization_id}
              href={`/gestion?org=${m.organization_id}`}
              aria-current={m.organization_id === current.organization_id ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-[600]",
                m.organization_id === current.organization_id
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-ink hover:border-ink/40",
              )}
            >
              {m.organization_name}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-sm font-[600] text-muted">
          {ORG_TYPE_LABEL[current.organization_type as OrgType] ?? current.organization_type}
        </p>
        <h2 className="text-xl font-[750] font-narrow">{current.organization_name}</h2>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: "À venir", value: upcoming.length },
          { label: "Brouillons", value: drafts.length },
          { label: "Inscrits à venir", value: registrations },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[var(--radius-card)] bg-surface p-3">
            <dt className="text-[0.8125rem] font-[600] text-muted">{stat.label}</dt>
            <dd className="text-2xl font-[800] font-condensed tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {canCreate && (
        <Link
          href={`/gestion/evenements/nouveau?org=${current.organization_id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-control)] bg-ink px-5 font-[620] text-paper"
        >
          Nouvel événement
        </Link>
      )}

      <section aria-labelledby="liste" className="flex flex-col gap-3">
        <h3 id="liste" className="text-lg font-[700] font-narrow">
          Événements
        </h3>
        {events.length === 0 ? (
          <EmptyState title="Aucun événement">Les événements de cette organisation apparaîtront ici.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
            {events.map((event) => {
              const status = statusLabel(event);
              return (
                <li key={event.id}>
                  <Link href={`/gestion/evenements/${event.id}`} className="flex flex-col gap-1 p-4 hover:bg-ink/5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[0.8125rem] font-[650]", status.className)}>
                        {status.label}
                      </span>
                      <span className="font-[650] text-ink">{event.title}</span>
                    </span>
                    <span className="text-sm text-muted">
                      {formatLongDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)} ·{" "}
                      {event.participantsCount} inscrit{event.participantsCount > 1 ? "s" : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {memberships.some(canModerate) && (
        <Link
          href="/gestion/moderation"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-line px-4 font-[620] text-ink hover:border-ink/40"
        >
          Espace de modération
        </Link>
      )}

      <p className="text-sm text-muted">
        <Link href="/evenements" className="underline underline-offset-4">
          Voir le fil des étudiants
        </Link>
      </p>
    </div>
  );
}

export default function ManagePage(props: PageProps<"/gestion">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Gestion</h1>
      <Suspense fallback={<p className="text-muted">Chargement de l’espace de gestion…</p>}>
        <Dashboard searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
