import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventCard, type EventCardData } from "./event-card";

const base: EventCardData = {
  title: "Job dating alternance",
  startsAt: new Date("2026-10-15T12:00:00Z"),
  endsAt: new Date("2026-10-15T15:00:00Z"),
  location: "Amphi B",
  organization: { name: "Pédagogie", type: "pedagogy" },
  participantsCount: 38,
  capacity: 60,
  status: "published",
};

describe("EventCard", () => {
  it("affiche l'heure dans le fuseau de l'école et la date complète pour les lecteurs d'écran", () => {
    render(<EventCard event={base} />);
    expect(screen.getByText("14:00 – 17:00")).toBeInTheDocument();
    expect(screen.getByText("jeudi 15 octobre")).toBeInTheDocument();
    expect(screen.getByText("22 places restantes")).toBeInTheDocument();
  });

  it("signale l'inscription", () => {
    render(<EventCard event={{ ...base, registered: true }} />);
    expect(screen.getByText("Tu es inscrit·e")).toBeInTheDocument();
  });

  it("signale un événement complet", () => {
    render(<EventCard event={{ ...base, participantsCount: 60 }} />);
    expect(screen.getByText("Complet")).toBeInTheDocument();
  });

  it("l'annulation prime sur l'inscription et masque les places", () => {
    render(<EventCard event={{ ...base, status: "cancelled", registered: true }} />);
    expect(screen.getByText("Annulé")).toBeInTheDocument();
    expect(screen.queryByText("Tu es inscrit·e")).not.toBeInTheDocument();
    expect(screen.queryByText(/places restantes/)).not.toBeInTheDocument();
  });

  it("n'est un lien que si une destination est fournie", () => {
    const { rerender } = render(<EventCard event={base} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(<EventCard event={base} href="/evenements/1" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/evenements/1");
  });
});
