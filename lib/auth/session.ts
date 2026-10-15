import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Couche d'accès aux données de session (Data Access Layer) : point unique pour savoir
 * qui est connecté. Toujours appelée derrière une frontière <Suspense> (lecture des cookies).
 */

export type Profile = {
  id: string;
  school_id: string;
  email: string;
  person_type: "student" | "staff";
  first_name: string;
  last_name: string;
  bio: string | null;
  status: "active" | "deactivated" | "unauthorized";
  pref_push_enabled: boolean;
  pref_message_notifications: boolean;
  pref_email_reminders: boolean;
  onboarding_completed_at: string | null;
};

export type CurrentUser = {
  id: string;
  email: string;
  aal: "aal1" | "aal2";
  profile: Profile | null;
  isPlatformAdmin: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const [{ data: profile }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("get_my_profile").maybeSingle<Profile>(),
    supabase.rpc("is_platform_admin"),
  ]);

  return {
    id: claims.sub,
    email: String(claims.email ?? ""),
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
    profile: profile?.id ? profile : null,
    isPlatformAdmin: Boolean(isAdmin),
  };
}

/** Utilisateur connecté avec un profil d'école actif et complet ; redirige sinon. */
export async function requireStudent(next?: string): Promise<CurrentUser & { profile: Profile }> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion${next ? `?suite=${encodeURIComponent(next)}` : ""}`);
  if (!user.profile) redirect(user.isPlatformAdmin ? "/admin" : "/connexion/acces-refuse");
  if (user.profile.status !== "active") redirect("/connexion/acces-refuse");
  if (!user.profile.first_name || !user.profile.last_name) redirect("/bienvenue");
  return user as CurrentUser & { profile: Profile };
}
