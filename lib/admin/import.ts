/** Import de listes d'étudiants : lecture du CSV et contrôle avant validation (pure logique, sans base). */

export const IMPORT_MAX_ROWS = 5000;

export type ImportRow = {
  line: number;
  email: string;
  first_name: string;
  last_name: string;
  person_type: "student" | "staff";
  cohort: string;
  external_id: string;
};

const COLUMNS: Record<string, keyof Omit<ImportRow, "line" | "person_type"> | "person_type"> = {
  email: "email",
  first_name: "first_name",
  prenom: "first_name",
  last_name: "last_name",
  nom: "last_name",
  person_type: "person_type",
  type: "person_type",
  cohort: "cohort",
  promotion: "cohort",
  external_id: "external_id",
  identifiant: "external_id",
};

/** Découpe une ligne CSV en gérant les champs entre guillemets. */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      fields.push(current.trim());
      current = "";
    } else current += ch;
  }
  fields.push(current.trim());
  return fields;
}

export function parseCsv(text: string): { ok: true; rows: ImportRow[] } | { ok: false; error: string } {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length < 2) return { ok: false, error: "Le fichier doit contenir un en-tête et au moins une ligne." };

  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitLine(lines[0], delimiter).map((h) => h.toLowerCase());
  if (!header.includes("email")) return { ok: false, error: "La colonne « email » est obligatoire." };
  if (lines.length - 1 > IMPORT_MAX_ROWS) {
    return { ok: false, error: `Maximum ${IMPORT_MAX_ROWS} lignes par import.` };
  }

  const rows: ImportRow[] = [];
  for (let n = 1; n < lines.length; n++) {
    const values = splitLine(lines[n], delimiter);
    const row: ImportRow = {
      line: n + 1,
      email: "",
      first_name: "",
      last_name: "",
      person_type: "student",
      cohort: "",
      external_id: "",
    };
    header.forEach((name, index) => {
      const target = COLUMNS[name];
      if (!target) return;
      const value = values[index] ?? "";
      if (target === "person_type") {
        const v = value.toLowerCase();
        row.person_type = v === "staff" || v === "personnel" ? "staff" : "student";
      } else {
        row[target] = target === "email" ? value.toLowerCase() : value;
      }
    });
    rows.push(row);
  }
  return { ok: true, rows };
}

export type ImportAnalysis = {
  /** Lignes prêtes à être importées (ajout ou mise à jour). */
  toImport: ImportRow[];
  added: number;
  updated: number;
  rejected: { line: number; email: string; reason: string }[];
  /** Adresses déjà présentes dans une autre école : non importées, à traiter à la main. */
  conflicts: { line: number; email: string }[];
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export function analyseRows(
  rows: ImportRow[],
  context: { domains: string[]; alreadyInSchool: Set<string>; inOtherSchools: Set<string> },
): ImportAnalysis {
  const result: ImportAnalysis = { toImport: [], added: 0, updated: 0, rejected: [], conflicts: [] };
  const seen = new Set<string>();

  for (const row of rows) {
    if (!EMAIL.test(row.email)) {
      result.rejected.push({ line: row.line, email: row.email, reason: "Adresse invalide" });
      continue;
    }
    if (seen.has(row.email)) {
      result.rejected.push({ line: row.line, email: row.email, reason: "Doublon dans le fichier" });
      continue;
    }
    seen.add(row.email);
    const domain = row.email.split("@")[1];
    if (!context.domains.includes(domain)) {
      result.rejected.push({ line: row.line, email: row.email, reason: "Domaine non déclaré pour cette école" });
      continue;
    }
    if (context.inOtherSchools.has(row.email)) {
      result.conflicts.push({ line: row.line, email: row.email });
      continue;
    }
    result.toImport.push(row);
    if (context.alreadyInSchool.has(row.email)) result.updated += 1;
    else result.added += 1;
  }
  return result;
}
