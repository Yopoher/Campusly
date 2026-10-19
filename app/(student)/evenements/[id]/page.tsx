import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrgBadge } from "@/components/events/org-badge";
import { Notice } from "@/components/ui/feedback";
import {
  formatLongDate,
  formatParticipants,
  formatRemainingSeats,
  formatTime,
  formatTimeRange,
  remainingSeats,
} from "@/lib/format";
import { requireStudent } from "@/lib/auth/session";
import { getEvent, getEventImageUrl, listParticipants } from "@/lib/events/queries";
import { RegistrationPanel } from "../registration-panel";

export const metadata: Metadata = { title: "Événement" };

function closedReason(event: {
  status: string;
  isPast: boolean;
  capacity: number | null;
  participantsCount: number;
  registrationDeadline: Date | null;
  startsAt: Date;
}) {
  if (event.status === "cancelled") return "Cet événement est annulé.";
  if (event.isPast) return "Cet événement est terminé.";
  if (remainingSeats(event.participantsCount, event.capacity) === 0) return "Cet événement est complet.";
  if (event.registrationDeadline && Date.now() > event.registrationDeadline.getTime())
    return "La date limite d’inscription est dépassée.";
  return "Les inscriptions sont fermées.";
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

async function EventContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStudent(`/evenements/${id}`);
  const event = await getEvent(id);
  if (!event) notFound();

  const participants = await listParticipants(id);
  const imageUrl = event.imagePath ? await getEventImageUrl(event.imagePath) : null;
  const seatsLeft = remainingSeats(event.participantsCount, event.capacity);
  const canManage = event.canEdit || event.canPublish || event.canCancel;

  return (
    <article className="flex flex-col gap-6">
      <Link href="/evenements" className="text-[0.9375rem] font-[600] text-muted hover:text-ink">
        ← Retour au fil
      </Link>

      {imageUrl && (
        // Lien signé et temporaire, produit par le serveur : pas d'optimisation d'image côté Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`Visuel de l’événement « ${event.title} »`}
          className="aspect-video w-full rounded-[var(--radius-card)] border border-line object-cover"
        />
      )}

      <header className="flex flex-col gap-3">
        <Link href={`/organisations/${event.organizationId}`} className="self-start">
          <OrgBadge name={event.organizationName} type={event.organizationType} />
        </Link>
        <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">{event.title}</h1>
      </header>

      {event.status === "cancelled" && (
        <Notice tone="error" title="Événement annulé">
          {event.cancellationReason ?? "Les inscriptions ne sont plus possibles."}
        </Notice>
      )}
      {event.isPast && event.status !== "cancelled" && <Notice tone="info" title="Cet événement est terminé." />}

      <dl className="flex flex-col gap-3 text-[0.9375rem]">
        <div>
          <dt className="sr-only">Date</dt>
          <dd className="font-[650] text-ink">
            {formatLongDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Lieu</dt>
          <dd className="text-ink">{event.location}</dd>
        </div>
        <div>
          <dt className="sr-only">Participants</dt>
          <dd className="text-muted">
            {formatParticipants(event.participantsCount)}
            {event.capacity != null && seatsLeft !== null && ` · ${formatRemainingSeats(seatsLeft)}`}
          </dd>
        </div>
        {event.registrationDeadline && event.registrationOpen && (
          <div>
            <dt className="sr-only">Date limite</dt>
            <dd className="text-muted">
              Inscriptions jusqu’au {formatLongDate(event.registrationDeadline)} à{" "}
              {formatTime(event.registrationDeadline)}
            </dd>
          </div>
        )}
      </dl>

      {event.description && <p className="leading-relaxed whitespace-pre-line text-ink">{event.description}</p>}

      {event.externalUrl && (
        <a
          href={event.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center self-start rounded-[var(--radius-control)] border border-line px-4 font-[620] text-ink hover:border-ink/40"
        >
          Lien externe
          <span className="sr-only"> (ouvre un site externe)</span>
        </a>
      )}

      {event.status !== "draft" && (
        <RegistrationPanel
          eventId={event.id}
          registered={event.registered}
          open={event.registrationOpen}
          closedReason={event.registered ? null : closedReason(event)}
        />
      )}

      <section aria-labelledby="participants" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="participants" className="text-lg font-[700] font-narrow">
          Inscrits · {participants.length}
        </h2>
        {participants.length === 0 ? (
          <p className="text-muted">Personne n’est encore inscrit·e.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {participants.map((p) => (
              <li key={p.user_id} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-[700] text-ink"
                >
                  {initials(p.first_name, p.last_name)}
                </span>
                <div className="min-w-0">
                  <p className="font-[650] text-ink">
                    {p.first_name} {p.last_name}
                  </p>
                  {p.bio && <p className="text-sm text-muted">{p.bio}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">Visible par les étudiants de ton école.</p>
      </section>

      {canManage && (
        <Link
          href={`/gestion/evenements/${event.id}`}
          className="self-start text-[0.9375rem] font-[600] text-ink underline underline-offset-4"
        >
          Gérer cet événement
        </Link>
      )}
    </article>
  );
}

export default function EventPage(props: PageProps<"/evenements/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Chargement de l’événement…</p>}>
      <EventContent params={props.params} />
    </Suspense>
  );
}
