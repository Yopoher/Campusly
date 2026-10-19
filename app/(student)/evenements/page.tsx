import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventCard as EventCardView } from "@/components/events/event-card";
import { Logo } from "@/components/ui/logo";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { requireStudent } from "@/lib/auth/session";
import { toCardData } from "@/lib/events/model";
import { getEventImageUrls, listEvents, listMemberships } from "@/lib/events/queries";

export const metadata: Metadata = { title: "Événements" };

const TABS = [
  { key: "upcoming", label: "À venir" },
  { key: "mine", label: "Mes événements" },
  { key: "past", label: "Passés" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const EMPTY: Record<Tab, { title: string; text: string }> = {
  upcoming: {
    title: "Rien à venir pour l’instant",
    text: "Les événements publiés par les organisations de ton école apparaîtront ici.",
  },
  mine: {
    title: "Tu n’es inscrit·e à aucun événement à venir",
    text: "Rejoins un événement depuis l’onglet « À venir » : il sera regroupé ici.",
  },
  past: { title: "Aucun événement passé", text: "Les événements terminés restent consultables ici." },
};

function parseTab(value: string | string[] | undefined): Tab {
  const single = Array.isArray(value) ? value[0] : value;
  return TABS.some((t) => t.key === single) ? (single as Tab) : "upcoming";
}

async function Greeting() {
  const { profile } = await requireStudent("/evenements");
  const memberships = await listMemberships();
  const canManage = memberships.some((m) => m.permissions.some((p) => p.startsWith("events.")));
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Bonjour {profile.first_name}</h1>
      {canManage && (
        <Link href="/gestion" className="text-[0.9375rem] font-[600] text-ink underline underline-offset-4">
          Gérer mes événements
        </Link>
      )}
    </div>
  );
}

function Tabs({ current }: { current: Tab }) {
  return (
    <nav aria-label="Vues du fil" className="border-b border-line">
      <ul className="flex gap-5">
        {TABS.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.key === "upcoming" ? "/evenements" : `/evenements?vue=${tab.key}`}
              aria-current={current === tab.key ? "page" : undefined}
              className={cn(
                "-mb-px inline-block border-b-2 pb-2.5 text-[0.9375rem] font-[600] transition-colors",
                current === tab.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

async function Feed({ tab }: { tab: Tab }) {
  await requireStudent(`/evenements${tab === "upcoming" ? "" : `?vue=${tab}`}`);
  let events;
  try {
    events = await listEvents(tab);
  } catch {
    return (
      <Notice tone="error" title="Les événements n’ont pas pu être chargés">
        Vérifie ta connexion, puis recharge la page.
      </Notice>
    );
  }
  if (events.length === 0) {
    return <EmptyState title={EMPTY[tab].title}>{EMPTY[tab].text}</EmptyState>;
  }
  const imageUrls = await getEventImageUrls(events.map((e) => e.imagePath));
  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id}>
          <EventCardView event={toCardData(event, imageUrls)} href={`/evenements/${event.id}`} />
        </li>
      ))}
    </ul>
  );
}

async function FeedPage({ searchParams }: { searchParams: Promise<{ vue?: string | string[] }> }) {
  const tab = parseTab((await searchParams).vue);
  return (
    <>
      <Tabs current={tab} />
      <Suspense fallback={<p className="text-muted">Chargement des événements…</p>}>
        <Feed tab={tab} />
      </Suspense>
    </>
  );
}

export default function EventsPage(props: PageProps<"/evenements">) {
  return (
    <div className="flex flex-col gap-6">
      <Logo size="sm" />
      <Suspense fallback={<div className="h-9" aria-hidden />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<p className="text-muted">Chargement des événements…</p>}>
        <FeedPage searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
