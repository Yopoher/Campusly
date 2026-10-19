"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseMemberForm, parseOrganizationForm, parseSchoolForm } from "@/lib/admin/forms";
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
