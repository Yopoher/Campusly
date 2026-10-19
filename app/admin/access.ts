import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Accès au back-office : super-administrateur avec second facteur vérifié dans cette session (aal2). */
export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/admin");
  if (!user.isPlatformAdmin) redirect("/");
  const supabase = await createSupabaseServerClient();
  if (user.aal !== "aal2") {
    const { data } = await supabase.auth.mfa.listFactors();
    redirect(data?.totp.some((f) => f.status === "verified") ? "/admin/verification" : "/admin/securite");
  }
  return supabase;
}
