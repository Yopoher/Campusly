import { describe, expect, it } from "vitest";
import { analyseRows, parseCsv } from "./import";

describe("Lecture du CSV", () => {
  it("accepte une virgule ou un point-virgule, avec des en-têtes en français", () => {
    const r = parseCsv("email;prenom;nom;type;promotion\nAlice.Test@ynov.com;Alice;Martin;etudiant;B1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows[0]).toMatchObject({ email: "alice.test@ynov.com", first_name: "Alice", cohort: "B1", line: 2 });
    }
  });

  it("gère les champs entre guillemets", () => {
    const r = parseCsv('email,last_name\n"bob.test@ynov.com","Le Roy, junior"');
    expect(r.ok && r.rows[0].last_name).toBe("Le Roy, junior");
  });

  it("refuse un fichier sans colonne email", () => {
    const r = parseCsv("nom,prenom\nMartin,Alice");
    expect(r.ok).toBe(false);
  });

  it("refuse un fichier vide", () => {
    expect(parseCsv("email").ok).toBe(false);
  });
});

describe("Contrôle avant import", () => {
  const rows = parseCsv(
    [
      "email,first_name",
      "a.test@ynov.com,Alice",
      "b.test@ynov.com,Bob",
      "a.test@ynov.com,Doublon",
      "c.test@gmail.com,Hors domaine",
      "pas-une-adresse,Invalide",
      "d.test@ynov.com,Ailleurs",
      "e.test@ynov.com,Déjà là",
    ].join("\n"),
  );

  it("classe chaque ligne : importée, ajoutée ou mise à jour, rejetée, en conflit", () => {
    if (!rows.ok) throw new Error("lecture impossible");
    const a = analyseRows(rows.rows, {
      domains: ["ynov.com"],
      alreadyInSchool: new Set(["e.test@ynov.com"]),
      inOtherSchools: new Set(["d.test@ynov.com"]),
    });
    expect(a.added).toBe(2);
    expect(a.updated).toBe(1);
    expect(a.toImport.map((r) => r.email)).toEqual(["a.test@ynov.com", "b.test@ynov.com", "e.test@ynov.com"]);
    expect(a.rejected.map((r) => r.reason)).toEqual([
      "Doublon dans le fichier",
      "Domaine non déclaré pour cette école",
      "Adresse invalide",
    ]);
    expect(a.conflicts).toEqual([{ line: 7, email: "d.test@ynov.com" }]);
  });
});
