"use server";

import { redirect } from "next/navigation";
import { codeSchema } from "@/lib/auth/login";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EnrollState = { factorId?: string; qrCode?: string; secret?: string; error?: string };
export type VerifyState = { error?: string };

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/connexion?suite=/admin");
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) redirect("/");
  return supabase;
}

/** Démarre l'enrôlement d'une application d'authentification (TOTP) : renvoie le QR code à scanner. */
export async function startEnrollmentAction(): Promise<EnrollState> {
  const supabase = await requireAdmin();
  // Supprime un enrôlement inachevé pour pouvoir recommencer proprement.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Campusly admin" });
  if (error || !data) return { error: "L’enrôlement n’a pas pu démarrer. Réessaie." };
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

async function challengeAndVerify(factorId: string, rawCode: string): Promise<VerifyState> {
  const code = codeSchema.safeParse(rawCode);
  if (!code.success) return { error: code.error.issues[0].message };
  const supabase = await requireAdmin();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) return { error: "Code incorrect ou expiré. Utilise le code affiché en ce moment dans ton application." };
  redirect("/admin");
}

/** Termine l'enrôlement en vérifiant un premier code : la session passe au niveau aal2. */
export async function confirmEnrollmentAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  return challengeAndVerify(String(formData.get("factor_id") ?? ""), String(formData.get("code") ?? ""));
}

/** Vérification du second facteur à chaque nouvelle session. */
export async function verifySecondFactorAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const supabase = await requireAdmin();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === "verified");
  if (!factor) redirect("/admin/securite");
  return challengeAndVerify(factor.id, String(formData.get("code") ?? ""));
}
