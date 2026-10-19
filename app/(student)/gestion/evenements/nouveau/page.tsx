import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";
import { listMemberships } from "@/lib/events/queries";
import { createEventAction } from "../../actions";
import { EventForm } from "../../event-form";

export const metadata: Metadata = { title: "Nouvel événement" };

async function NewEventContent({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  await requireStudent("/gestion/evenements/nouveau");
  const creators = (await listMemberships()).filter((m) => m.permissions.includes("events.create"));

  if (creators.length === 0) {
    return (
      <EmptyState title="Tu ne peux pas créer d’événement">
        Ton rôle ne permet pas de publier au nom d’une organisation.
      </EmptyState>
    );
  }
  const selected = creators.find((m) => m.organization_id === org) ?? creators[0];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/gestion?org=${selected.organization_id}`}
        className="text-[0.9375rem] font-[600] text-muted hover:text-ink"
      >
        ← Retour à la gestion
      </Link>
      <EventForm
        mode="create"
        action={createEventAction}
        organizations={creators.map((m) => ({ id: m.organization_id, name: m.organization_name }))}
        organizationId={selected.organization_id}
        defaults={{}}
        canPublish
      />
    </div>
  );
}

export default function NewEventPage(props: PageProps<"/gestion/evenements/nouveau">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Nouvel événement</h1>
      <Suspense fallback={<p className="text-muted">Chargement du formulaire…</p>}>
        <NewEventContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
