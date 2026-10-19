import { describe, expect, it } from "vitest";
import { zonedLocalToUtc, utcToZonedLocal } from "./time";

describe("zonedLocalToUtc (heure de l'école, Europe/Paris)", () => {
  it("convertit une heure d'été (UTC+2)", () => {
    expect(zonedLocalToUtc("2026-10-24T18:30")?.toISOString()).toBe("2026-10-24T16:30:00.000Z");
  });

  it("convertit une heure d'hiver (UTC+1)", () => {
    expect(zonedLocalToUtc("2027-01-15T18:30")?.toISOString()).toBe("2027-01-15T17:30:00.000Z");
  });

  it("gère le passage à l'heure d'hiver du dernier dimanche d'octobre", () => {
    // 2026-10-25 : à 03:00 locales, les horloges reculent à 02:00 (CEST -> CET).
    expect(zonedLocalToUtc("2026-10-25T01:30")?.toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(zonedLocalToUtc("2026-10-25T04:00")?.toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });

  it("refuse une heure qui n'existe pas (saut de l'heure d'été)", () => {
    // 2027-03-28 : à 02:00 locales, les horloges avancent à 03:00.
    expect(zonedLocalToUtc("2027-03-28T02:30")).toBeNull();
  });

  it("refuse une date impossible", () => {
    expect(zonedLocalToUtc("2026-02-30T10:00")).toBeNull();
    expect(zonedLocalToUtc("2026-13-01T10:00")).toBeNull();
  });

  it("refuse un format qui n'est pas celui d'un champ datetime-local", () => {
    expect(zonedLocalToUtc("24/10/2026 18:30")).toBeNull();
    expect(zonedLocalToUtc("")).toBeNull();
  });

  it("fait l'aller-retour avec l'affichage", () => {
    const date = zonedLocalToUtc("2026-10-24T18:30")!;
    expect(utcToZonedLocal(date)).toBe("2026-10-24T18:30");
  });
});
