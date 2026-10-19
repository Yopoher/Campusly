import { describe, expect, it } from "vitest";
import { parseEventForm } from "./form";

const ORG = "a2000000-0000-0000-0000-000000000000";

/** Formulaire valide, daté en 2099 pour rester dans le futur. */
function formData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    organization_id: ORG,
    title: "Soirée intégration",
    description: "Pour tout le monde",
    starts_at: "2099-10-24T18:30",
    ends_at: "2099-10-24T22:00",
    location: "Foyer",
    capacity: "40",
    registration_deadline: "2099-10-23T12:00",
    external_url: "",
    publish: "1",
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) fd.set(key, value);
  return fd;
}

describe("parseEventForm", () => {
  it("accepte un formulaire complet et prépare les dates en UTC", () => {
    const result = parseEventForm(formData());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rpc).toMatchObject({
      p_org: ORG,
      p_title: "Soirée intégration",
      p_starts_at: "2099-10-24T16:30:00.000Z",
      p_ends_at: "2099-10-24T20:00:00.000Z",
      p_capacity: 40,
      p_registration_deadline: "2099-10-23T10:00:00.000Z",
      p_external_url: null,
      p_publish: true,
    });
  });

  it("accepte un brouillon sans options facultatives", () => {
    const result = parseEventForm(formData({ ends_at: "", capacity: "", registration_deadline: "", publish: "" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rpc).toMatchObject({
      p_ends_at: null,
      p_capacity: null,
      p_registration_deadline: null,
      p_publish: false,
    });
  });

  it("signale un titre trop court sans bloquer les autres champs", () => {
    const result = parseEventForm(formData({ title: "ab" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.title).toMatch(/au moins 3/);
    expect(Object.keys(result.errors)).toEqual(["title"]);
  });

  it("refuse une date de début dans le passé", () => {
    const result = parseEventForm(formData({ starts_at: "2001-01-01T10:00" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.starts_at).toMatch(/futur/);
  });

  it("refuse une fin avant le début", () => {
    const result = parseEventForm(formData({ ends_at: "2099-10-24T17:00" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.ends_at).toMatch(/après le début/);
  });

  it("refuse une date limite d'inscription après le début", () => {
    const result = parseEventForm(formData({ registration_deadline: "2099-10-25T10:00" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.registration_deadline).toMatch(/avant le début/);
  });

  it.each(["0", "-3", "2.5", "beaucoup"])("refuse la capacité « %s »", (capacity) => {
    const result = parseEventForm(formData({ capacity }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.capacity).toMatch(/entier/);
  });

  it("refuse un lien qui n'est pas en https", () => {
    const result = parseEventForm(formData({ external_url: "http://exemple.test" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.external_url).toMatch(/https/);
  });

  it("accepte un lien https", () => {
    const result = parseEventForm(formData({ external_url: "https://exemple.test/inscription" }));
    expect(result.ok).toBe(true);
  });

  it("refuse une date qui n'existe pas", () => {
    const result = parseEventForm(formData({ starts_at: "2099-02-30T10:00" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.starts_at).toMatch(/pas valide/);
  });
});
