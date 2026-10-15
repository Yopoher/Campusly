"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EventCard, type EventCardData } from "@/components/events/event-card";

/** Démonstration du geste central : s’inscrire pose le surligneur sur la date. */
export function RegisterDemo({ event }: { event: EventCardData }) {
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggle() {
    setLoading(true);
    setTimeout(() => {
      setRegistered((r) => !r);
      setLoading(false);
    }, 600);
  }

  return (
    <div className="flex flex-col gap-3">
      <EventCard event={{ ...event, registered, participantsCount: event.participantsCount + (registered ? 1 : 0) }} />
      <div className="flex items-center gap-3">
        <Button
          variant={registered ? "secondary" : "primary"}
          onClick={toggle}
          loading={loading}
          loadingLabel={registered ? "Désinscription…" : "Inscription…"}
        >
          {registered ? "Me désinscrire" : "M’inscrire"}
        </Button>
        <p role="status" className="text-sm text-muted">
          {registered ? "Tu es inscrit·e. Tu recevras un rappel la veille." : ""}
        </p>
      </div>
    </div>
  );
}
