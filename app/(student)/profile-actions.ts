"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProfileFormState = { error?: string; saved?: boolean };

/** Enregistre prénom, nom et présentation via update_my_profile (contrôles en base). */
export async function saveProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_first_name: String(formData.get("first_name") ?? ""),
    p_last_name: String(formData.get("last_name") ?? ""),
    p_bio: String(formData.get("bio") ?? ""),
  });
  if (error) {
    // Messages de validation écrits en base pour l'utilisateur (code 22023) ; sinon message générique.
    return { error: error.code === "22023" ? error.message : "L’enregistrement n’a pas abouti. Réessaie." };
  }
  revalidatePath("/profil");
  if (formData.get("onboarding") === "1") redirect("/evenements");
  return { saved: true };
}
