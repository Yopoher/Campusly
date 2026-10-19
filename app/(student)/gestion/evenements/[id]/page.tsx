import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Notice } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { utcToZonedLocal } from "@/lib/events/time";
import { getEvent } from "@/lib/events/queries";
import { cancelEventAction, updateEventAction } from "../../actions";
import { CancelEventForm } from "../../cancel-event-form";
import { EventForm } from "../../event-form";

export const metadata: Metadata = { title: "Modifier l’événement" };

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStudent(`/gestion/evenements/${id}`);
  const event = await getEvent(id);
  if (!event || !event.isOrgMember) notFound();

  const editable = event.canEdit && event.status !== "cancelled" && !event.isPast;

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/gestion?org=${event.organizationId}`}
        className="text-[0.9375rem] font-[600] text-muted hover:text-ink"
      >
        ← Retour à la gestion
      </Link>

      {event.status === "draft" && <Notice tone="info" title="Brouillon : visible seulement par ton organisation." />}
      {event.status === "cancelled" && (
        <Notice tone="error" title="Événement annulé">
          Il ne peut plus être modifié. {event.cancellationReason ?? ""}
        </Notice>
      )}
      {event.isPast && event.status !== "cancelled" && (
        <Notice tone="info" title="Événement terminé">
          Il ne peut plus être modifié.
        </Notice>
      )}

      {editable ? (
        <EventForm
          mode="edit"
          action={updateEventAction.bind(null, event.id)}
          organizations={[]}
          organizationId={event.organizationId}
          canPublish={event.canPublish && event.status === "draft"}
          defaults={{
            title: event.title,
            description: event.description,
            starts_at: utcToZonedLocal(event.startsAt),
            ends_at: event.endsAt ? utcToZonedLocal(event.endsAt) : "",
            location: event.location,
            capacity: event.capacity ? String(event.capacity) : "",
            registration_deadline: event.registrationDeadline ? utcToZonedLocal(event.registrationDeadline) : "",
            external_url: event.externalUrl ?? "",
          }}
        />
      ) : (
        <p className="text-muted">{event.title}</p>
      )}

      {event.status === "published" && !event.isPast && event.canCancel && (
        <section aria-labelledby="annulation" className="flex flex-col gap-4 border-t border-line pt-6">
          <h2 id="annulation" className="text-lg font-[700] font-narrow">
            Annuler l’événement
          </h2>
          <CancelEventForm action={cancelEventAction.bind(null, event.id)} />
        </section>
      )}
    </div>
  );
}

export default function EditEventPage(props: PageProps<"/gestion/evenements/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Modifier l’événement</h1>
      <Suspense fallback={<p className="text-muted">Chargement de l’événement…</p>}>
        <EditContent params={props.params} />
      </Suspense>
    </div>
  );
}
