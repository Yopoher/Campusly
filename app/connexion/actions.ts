"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestLoginCode, safeNextPath, verifyLoginCode } from "@/lib/auth/login";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState =
  { step: "email"; error?: string; email?: string } | { step: "code"; email: string; error?: string; notice?: string };

const MESSAGES = {
  throttled: "Trop de demandes en peu de temps. Réessaie dans une heure.",
  error: "Le service de connexion ne répond pas. Réessaie dans quelques minutes.",
  expired: "Ce code n’est plus valable ou a déjà servi. Demande un nouveau code.",
  verifyThrottled: "Trop d’essais. Demande un nouveau code dans quelques minutes.",
};

async function ipHash() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  return ip ? createHash("sha256").update(ip).digest("hex") : null;
}

export async function requestCodeAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const raw = String(formData.get("email") ?? "");
  const result = await requestLoginCode(raw, await ipHash(), {
    precheck: async (email, ip) => {
      const { data, error } = await createSupabaseServiceClient().rpc("login_precheck", {
        p_email: email,
        p_ip_hash: ip,
      });
      if (error) throw error;
      return String(data);
    },
    sendCode: async (email) => {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      return { errorStatus: error?.status };
    },
  });

  switch (result.status) {
    case "sent":
      return { step: "code", email: result.email };
    case "invalid":
      return { step: "email", email: raw, error: result.message };
    case "throttled":
      return { step: "email", email: raw, error: MESSAGES.throttled };
    default:
      return { step: "email", email: raw, error: MESSAGES.error };
  }
}

export async function verifyCodeAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  const next = String(formData.get("suite") ?? "");
  const supabase = await createSupabaseServerClient();

  const result = await verifyLoginCode(email, code, {
    verify: async (e, c) => {
      const { error } = await supabase.auth.verifyOtp({ email: e, token: c, type: "email" });
      return { errorStatus: error?.status, errorCode: error?.code };
    },
  });

  if (result.status === "invalid") return { step: "code", email, error: result.message };
  if (result.status === "expired") return { step: "code", email, error: MESSAGES.expired };
  if (result.status === "throttled") return { step: "code", email, error: MESSAGES.verifyThrottled };
  if (result.status === "error") return { step: "code", email, error: MESSAGES.error };

  // Connecté : profil à compléter, back-office, ou destination demandée.
  const { data: profile } = await supabase
    .rpc("get_my_profile")
    .maybeSingle<{ id: string; first_name: string; last_name: string }>();
  if (!profile?.id) {
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    redirect(isAdmin ? "/admin" : "/connexion/acces-refuse");
  }
  if (!profile.first_name || !profile.last_name) redirect("/bienvenue");
  redirect(safeNextPath(next));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/connexion");
}
