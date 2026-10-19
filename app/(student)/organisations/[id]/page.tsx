import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventCard as EventCardView } from "@/components/events/event-card";
import { OrgBadge, type OrgType } from "@/components/events/org-badge";
import { EmptyState } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { ORG_TYPE_LABEL, toCardData } from "@/lib/events/model";
import { getOrganization, listOrganizationEvents } from "@/lib/events/queries";

export const metadata: Metadata = { title: "Organisation" };

async function OrganizationContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStudent(`/organisations/${id}`);
  const organization = await getOrganization(id);
  if (!organization) notFound();
  const events = await listOrganizationEvents(id);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/evenements" className="text-[0.9375rem] font-[600] text-muted hover:text-ink">
        ← Retour au fil
      </Link>
      <header className="flex flex-col gap-3">
        <OrgBadge name={organization.name} type={organization.type as OrgType} className="text-base" />
        <p className="text-sm font-[600] text-muted">{ORG_TYPE_LABEL[organization.type as OrgType]}</p>
        <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">{organization.name}</h1>
        {organization.description && <p className="leading-relaxed text-ink">{organization.description}</p>}
      </header>

      <section aria-labelledby="a-venir" className="flex flex-col gap-3">
        <h2 id="a-venir" className="text-lg font-[700] font-narrow">
          Événements à venir
        </h2>
        {events.length === 0 ? (
          <EmptyState title="Aucun événement à venir">Cette organisation n’a rien de prévu pour l’instant.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((event) => (
              <li key={event.id}>
                <EventCardView event={toCardData(event)} href={`/evenements/${event.id}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function OrganizationPage(props: PageProps<"/organisations/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Chargement de l’organisation…</p>}>
      <OrganizationContent params={props.params} />
    </Suspense>
  );
}
