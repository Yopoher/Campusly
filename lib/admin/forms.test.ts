import { describe, expect, it } from "vitest";
import { parseMemberForm, parseOrganizationForm, parseSchoolForm } from "./forms";

function form(values: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const v of Array.isArray(value) ? value : [value]) f.append(key, v);
  }
  return f;
}

describe("Formulaire d'école", () => {
  const base = { name: "École Test", slug: "ecole-test", domains: "ecole.test.ynov.com" };

  it("accepte une école complète et met le domaine en minuscules", () => {
    const r = parseSchoolForm(
      form({ ...base, domains: "Ecole.Test.ynov.com, autre.test.ynov.com", timezone: "Europe/Paris" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.domains).toEqual(["ecole.test.ynov.com", "autre.test.ynov.com"]);
  });

  it("refuse un identifiant avec espaces ou majuscules mal formé", () => {
    const r = parseSchoolForm(form({ ...base, slug: "ecole test" }));
    expect(r.ok).toBe(false);
  });

  it("refuse un domaine invalide", () => {
    const r = parseSchoolForm(form({ ...base, domains: "pas-un-domaine" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Domaine invalide");
  });

  it("refuse un fuseau horaire inconnu", () => {
    expect(parseSchoolForm(form({ ...base, timezone: "Mars/Olympus" })).ok).toBe(false);
  });

  it("utilise Europe/Paris si aucun fuseau n'est donné", () => {
    const r = parseSchoolForm(form(base));
    expect(r.ok && r.values.timezone).toBe("Europe/Paris");
  });
});

describe("Formulaire d'organisation", () => {
  it("accepte un BDE et refuse le type « École »", () => {
    expect(parseOrganizationForm(form({ name: "BDE Test", type: "bde", description: "" })).ok).toBe(true);
    expect(parseOrganizationForm(form({ name: "BDE Test", type: "school", description: "" })).ok).toBe(false);
  });

  it("refuse un nom trop court", () => {
    expect(parseOrganizationForm(form({ name: "A", type: "bde", description: "" })).ok).toBe(false);
  });
});

describe("Formulaire de membre", () => {
  it("garde seulement les permissions connues", () => {
    const r = parseMemberForm(form({ email: "Membre.Test@ynov.com", permissions: ["events.create", "inventee"] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toEqual({ email: "membre.test@ynov.com", permissions: ["events.create"] });
  });

  it("refuse une adresse invalide", () => {
    expect(parseMemberForm(form({ email: "pas une adresse", permissions: [] })).ok).toBe(false);
  });
});
