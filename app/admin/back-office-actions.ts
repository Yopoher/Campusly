"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseMemberForm, parseOrganizationForm, parseSchoolForm } from "@/lib/admin/forms";
import { analyseRows, parseCsv } from "@/lib/admin/import";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BackOfficeState = { error?: string; done?: string };

const uuid = z.guid();

/** Messages lisibles : les erreurs de règle viennent de la base (en français) ; le reste est générique. */
function messageFor(error: { code?: string; message?: string }) {
  if (error.code === "42501") return "Accès refusé. Reconnecte-toi et valide le second facteur.";
  if (error.code === "23505") return "Cet identifiant est déjà utilisé.";
  if (["22023", "P0001", "P0002"].includes(error.code ?? "")) return error.message ?? "Enregistrement impossible.";
  return "Enregistrement impossible. Réessaie.";
}

/** Création d'une école (super-admin, second facteur exigé par la base). */
export async function createSchoolAction(_prev: BackOfficeState, formData: FormData): Promise<BackOfficeState> {
  const parsed = parseSchoolForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_create_school", {
    p_name: parsed.values.name,
    p_slug: parsed.values.slug,
    p_domains: parsed.values.domains,
    p_timezone: parsed.values.timezone,
  });
  if (error || !data) return { error: messageFor(error ?? {}) };
  revalidatePath("/admin", "layout");
  redirect(`/admin/ecoles/${data}`);
}

export async function createOrganizationAction(_prev: BackOfficeState, formData: FormData): Promise<BackOfficeState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  if (!schoolId) return { error: "École introuvable." };
  const parsed = parseOrganizationForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_create_organization", {
    p_school: schoolId,
    p_name: parsed.values.name,
    p_type: parsed.values.type,
    p_description: parsed.values.description || null,
  });
  if (error) return { error: messageFor(error) };
  revalidatePath(`/admin/ecoles/${schoolId}`);
  return { done: "Organisation créée." };
}

export async function addMemberAction(_prev: BackOfficeState, formData: FormData): Promise<BackOfficeState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  const orgId = uuid.safeParse(formData.get("organization_id")).data;
  if (!schoolId || !orgId) return { error: "Organisation introuvable." };
  const parsed = parseMemberForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_add_member", {
    p_org: orgId,
    p_email: parsed.values.email,
    p_permissions: parsed.values.permissions,
  });
  if (error) {
    // Le compte doit s'être connecté au moins une fois : message explicite.
    if (error.code === "P0002") return { error: "Cette personne doit d’abord se connecter une fois à Campusly." };
    return { error: messageFor(error) };
  }
  revalidatePath(`/admin/ecoles/${schoolId}`);
  return { done: "Membre ajouté." };
}

/** Résultat du contrôle d'un import : ce qui sera fait, ce qui sera refusé et ce qui doit être traité à la main. */
export type ImportPreview = {
  added: number;
  updated: number;
  toImportCount: number;
  rejected: { line: number; email: string; reason: string }[];
  conflicts: { line: number; email: string }[];
};

export type ImportState = {
  error?: string;
  preview?: ImportPreview;
  /** Contenu vérifié, renvoyé au formulaire de confirmation (il est contrôlé à nouveau au moment de l'import). */
  csv?: string;
  done?: { inserted: number; updated: number; rejected: number };
};

async function analyseForSchool(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  csv: string,
) {
  const parsed = parseCsv(csv);
  if (!parsed.ok) return { error: parsed.error };
  const emails = [...new Set(parsed.rows.map((r) => r.email))];

  const { data: domainRows } = await supabase.from("school_domains").select("domain").eq("school_id", schoolId);
  const { data: schoolRows } = await supabase.from("allowed_emails").select("email").eq("school_id", schoolId);
  const inOtherSchools = new Set<string>();
  for (let i = 0; i < emails.length; i += 300) {
    const { data } = await supabase
      .from("allowed_emails")
      .select("email")
      .in("email", emails.slice(i, i + 300))
      .neq("school_id", schoolId);
    for (const row of (data ?? []) as { email: string }[]) inOtherSchools.add(row.email);
  }

  const analysis = analyseRows(parsed.rows, {
    domains: ((domainRows ?? []) as { domain: string }[]).map((d) => d.domain),
    alreadyInSchool: new Set(((schoolRows ?? []) as { email: string }[]).map((r) => r.email)),
    inOtherSchools,
  });
  return { analysis };
}

/** Vérifie le fichier sans rien enregistrer : renvoie le résumé à valider. */
export async function importPreviewAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  if (!schoolId) return { error: "École introuvable." };
  const csv = String(formData.get("csv") ?? "");
  if (!csv.trim()) return { error: "Choisis un fichier CSV ou colle son contenu." };

  const supabase = await createSupabaseServerClient();
  const result = await analyseForSchool(supabase, schoolId, csv);
  if (!("analysis" in result) || !result.analysis) return { error: result.error };
  const a = result.analysis;
  return {
    csv,
    preview: {
      added: a.added,
      updated: a.updated,
      toImportCount: a.toImport.length,
      rejected: a.rejected,
      conflicts: a.conflicts,
    },
  };
}

/** Importe les lignes vérifiées (ajout et mise à jour), en repassant tous les contrôles. */
export async function importConfirmAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  if (!schoolId) return { error: "École introuvable." };
  const csv = String(formData.get("csv") ?? "");
  const filename = String(formData.get("filename") ?? "").slice(0, 200) || null;

  const supabase = await createSupabaseServerClient();
  const result = await analyseForSchool(supabase, schoolId, csv);
  if (!("analysis" in result) || !result.analysis) return { error: result.error };
  const a = result.analysis;
  if (a.toImport.length === 0) return { error: "Aucune ligne valide à importer." };

  const { error } = await supabase.rpc("admin_import_allowed_emails", {
    p_school: schoolId,
    p_rows: a.toImport.map((r) => ({
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
      person_type: r.person_type,
      cohort: r.cohort,
      external_id: r.external_id,
    })),
    p_filename: filename,
  });
  if (error) return { error: messageFor(error) };

  revalidatePath(`/admin/ecoles/${schoolId}`);
  redirect(`/admin/ecoles/${schoolId}`);
}
