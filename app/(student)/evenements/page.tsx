import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { EmptyState } from "@/components/ui/feedback";
import { requireStudent } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Événements" };

async function Greeting() {
  const { profile } = await requireStudent("/evenements");
  return <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Bonjour {profile.first_name}</h1>;
}

export default function EventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Logo size="sm" />
      <Suspense fallback={<div className="h-9" aria-hidden />}>
        <Greeting />
      </Suspense>
      {/* Le fil des événements est construit en Phase 4. */}
      <EmptyState title="Le fil des événements arrive bientôt">
        Tu verras ici les événements publiés par le BDE, les associations et la pédagogie de ton campus.
      </EmptyState>
    </div>
  );
}
