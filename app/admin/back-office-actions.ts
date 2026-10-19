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
  return `Enregistrement impossible (code ${error.code ?? "inconnu"}). Réessaie.`;
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
  mode: "add" | "replace";
  added: number;
  updated: number;
  toImportCount: number;
  rejected: { line: number; email: string; reason: string }[];
  conflicts: { line: number; email: string }[];
  /** Mode « remplacer » : adresses actuellement autorisées et absentes du fichier, qui seront retirées. */
  removals: string[];
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
  const { data: schoolRows } = await supabase.from("allowed_emails").select("email, status").eq("school_id", schoolId);
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
  const authorizedNow = ((schoolRows ?? []) as { email: string; status: string }[])
    .filter((r) => r.status === "authorized")
    .map((r) => r.email);
  return { analysis, authorizedNow };
}

function modeOf(formData: FormData): "add" | "replace" {
  return formData.get("mode") === "replace" ? "replace" : "add";
}

/** Vérifie le fichier sans rien enregistrer : renvoie le résumé à valider. */
export async function importPreviewAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  if (!schoolId) return { error: "École introuvable." };
  const csv = String(formData.get("csv") ?? "");
  if (!csv.trim()) return { error: "Choisis un fichier CSV ou colle son contenu." };

  const mode = modeOf(formData);
  const supabase = await createSupabaseServerClient();
  const result = await analyseForSchool(supabase, schoolId, csv);
  if (!("analysis" in result) || !result.analysis) return { error: result.error };
  const a = result.analysis;
  if (mode === "replace" && a.toImport.length === 0) {
    return { error: "Aucune ligne valide : le remplacement est annulé pour protéger la liste actuelle." };
  }
  const keep = new Set(a.toImport.map((r) => r.email));
  const removals = mode === "replace" ? result.authorizedNow.filter((e) => !keep.has(e)).sort() : [];
  return {
    csv,
    preview: {
      mode,
      added: a.added,
      updated: a.updated,
      toImportCount: a.toImport.length,
      rejected: a.rejected,
      conflicts: a.conflicts,
      removals,
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
  const mode = modeOf(formData);

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

  if (mode === "replace") {
    // Les adresses absentes du fichier sont retirées après l'import. Les comptes concernés ne peuvent plus accéder aux données.
    const { error: removeError } = await supabase.rpc("admin_remove_allowed_emails", {
      p_school: schoolId,
      p_keep: a.toImport.map((r) => r.email),
    });
    if (removeError) return { error: `Import enregistré, mais le retrait a échoué : ${messageFor(removeError)}` };
  }

  revalidatePath(`/admin/ecoles/${schoolId}`);
  redirect(`/admin/ecoles/${schoolId}`);
}

/** Modification du nom, du fuseau horaire et des domaines d'une école. */
export async function updateSchoolAction(_prev: BackOfficeState, formData: FormData): Promise<BackOfficeState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  if (!schoolId) return { error: "École introuvable." };
  const domains = String(formData.get("domains") ?? "")
    .split(/[\s,;]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "Europe/Paris";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_school", {
    p_school: schoolId,
    p_name: name,
    p_timezone: timezone,
    p_domains: domains,
  });
  if (error) return { error: messageFor(error) };
  revalidatePath(`/admin/ecoles/${schoolId}`, "layout");
  revalidatePath("/admin");
  return { done: "École modifiée." };
}

/** Désactivation ou réactivation d'une école (aucune suppression définitive). */
export async function setSchoolStatusAction(_prev: BackOfficeState, formData: FormData): Promise<BackOfficeState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  if (!schoolId) return { error: "École introuvable." };
  const status = formData.get("status") === "active" ? "active" : "disabled";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_school_status", { p_school: schoolId, p_status: status });
  if (error) return { error: messageFor(error) };
  revalidatePath(`/admin/ecoles/${schoolId}`, "layout");
  revalidatePath("/admin");
  return { done: status === "active" ? "École réactivée." : "École désactivée." };
}

/** Modification d'une organisation : nom, description et statut (désactivation, sans suppression). */
export async function updateOrganizationAction(_prev: BackOfficeState, formData: FormData): Promise<BackOfficeState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  const orgId = uuid.safeParse(formData.get("organization_id")).data;
  if (!schoolId || !orgId) return { error: "Organisation introuvable." };
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 120) return { error: "Le nom doit contenir entre 2 et 120 caractères." };
  const status = formData.get("status") === "disabled" ? "disabled" : "active";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_organization", {
    p_org: orgId,
    p_name: name,
    p_description: String(formData.get("description") ?? "").trim() || null,
    p_status: status,
  });
  if (error) return { error: messageFor(error) };
  revalidatePath(`/admin/ecoles/${schoolId}`);
  return { done: "Organisation modifiée." };
}

/** Suppression définitive d'une organisation vide (la base refuse si elle contient des événements). */
export async function deleteOrganizationAction(_prev: BackOfficeState, formData: FormData): Promise<BackOfficeState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  const orgId = uuid.safeParse(formData.get("organization_id")).data;
  if (!schoolId || !orgId) return { error: "Organisation introuvable." };
  if (formData.get("confirm") !== "on") return { error: "Coche la case de confirmation pour supprimer." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_delete_organization", { p_org: orgId });
  if (error) return { error: messageFor(error) };
  revalidatePath(`/admin/ecoles/${schoolId}`);
  return { done: "Organisation supprimée." };
}

/** Suppression définitive d'une école vide (la base refuse si elle contient des personnes ou des données). */
export async function deleteSchoolAction(_prev: BackOfficeState, formData: FormData): Promise<BackOfficeState> {
  const schoolId = uuid.safeParse(formData.get("school_id")).data;
  if (!schoolId) return { error: "École introuvable." };
  if (formData.get("confirm") !== "on") return { error: "Coche la case de confirmation pour supprimer." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_delete_school", { p_school: schoolId });
  if (error) return { error: messageFor(error) };
  revalidatePath("/admin", "layout");
  redirect("/admin");
}
