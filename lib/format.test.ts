import { describe, expect, it } from "vitest";
import {
  dateBlockParts,
  formatParticipants,
  formatRemainingSeats,
  formatTime,
  formatTimeRange,
  remainingSeats,
} from "./format";

describe("dates dans le fuseau de l'école", () => {
  it("compose la colonne de date en français, en minuscules", () => {
    expect(dateBlockParts(new Date("2026-10-15T16:30:00Z"))).toEqual({ weekday: "jeu.", day: "15", month: "oct." });
  });

  it("affiche la même heure locale de part et d'autre du passage à l'heure d'hiver (25 octobre 2026)", () => {
    expect(formatTime(new Date("2026-10-24T16:30:00Z"))).toBe("18:30"); // UTC+2
    expect(formatTime(new Date("2026-10-26T17:30:00Z"))).toBe("18:30"); // UTC+1
  });

  it("utilise le fuseau de l'école, pas celui de la machine", () => {
    const d = new Date("2026-10-15T22:30:00Z");
    expect(dateBlockParts(d, "Europe/Paris").day).toBe("16");
    expect(dateBlockParts(d, "America/Martinique").day).toBe("15");
  });

  it("affiche une plage horaire ou une heure seule", () => {
    const start = new Date("2026-10-15T16:30:00Z");
    expect(formatTimeRange(start, new Date("2026-10-15T21:00:00Z"))).toBe("18:30 – 23:00");
    expect(formatTimeRange(start, null)).toBe("18:30");
  });
});

describe("inscriptions et places", () => {
  it("accorde le nombre d'inscrits", () => {
    expect(formatParticipants(0)).toBe("Personne n'est encore inscrit");
    expect(formatParticipants(1)).toBe("1 inscrit");
    expect(formatParticipants(12)).toBe("12 inscrits");
  });

  it("calcule les places restantes sans descendre sous zéro", () => {
    expect(remainingSeats(12, null)).toBeNull();
    expect(remainingSeats(12, 20)).toBe(8);
    expect(remainingSeats(25, 20)).toBe(0);
    expect(formatRemainingSeats(0)).toBe("Complet");
    expect(formatRemainingSeats(1)).toBe("1 place restante");
    expect(formatRemainingSeats(8)).toBe("8 places restantes");
  });
});
