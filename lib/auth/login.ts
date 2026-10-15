import { z } from "zod";

/**
 * Logique de connexion par code, indépendante de Next.js pour être testée seule.
 * Les dépendances (contrôle en base, envoi et vérification du code) sont injectées.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Saisis une adresse e-mail valide, par exemple prenom.nom@ynov.com." }));

export const codeSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, { message: "Le code contient 6 chiffres." }));

export type RequestCodeResult =
  | { status: "sent"; email: string }
  | { status: "invalid"; message: string }
  | { status: "throttled" }
  | { status: "error" };

export type RequestCodeDeps = {
  /** Contrôle en base : 'ok' | 'denied' | 'throttled' (fonction login_precheck). */
  precheck: (email: string, ipHash: string | null) => Promise<string>;
  /** Envoi du code par Supabase Auth ; renvoie un statut HTTP d'erreur éventuel. */
  sendCode: (email: string) => Promise<{ errorStatus?: number }>;
};

/**
 * Demande d'un code. Une adresse non autorisée reçoit exactement la même réponse qu'une adresse autorisée
 * (« si ton adresse est autorisée, tu vas recevoir un code ») : la liste des étudiants n'est jamais révélée.
 */
export async function requestLoginCode(
  rawEmail: string,
  ipHash: string | null,
  deps: RequestCodeDeps,
): Promise<RequestCodeResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0].message };
  const email = parsed.data;

  let check: string;
  try {
    check = await deps.precheck(email, ipHash);
  } catch {
    return { status: "error" };
  }
  if (check === "throttled") return { status: "throttled" };
  if (check !== "ok") return { status: "sent", email };

  const { errorStatus } = await deps.sendCode(email);
  if (errorStatus === 429) return { status: "throttled" };
  // Un refus du service Auth (hook) est traité comme une adresse non autorisée : même réponse neutre.
  if (errorStatus && errorStatus !== 403 && errorStatus !== 422) return { status: "error" };
  return { status: "sent", email };
}

export type VerifyCodeResult =
  | { status: "verified" }
  | { status: "invalid"; message: string }
  | { status: "expired" }
  | { status: "throttled" }
  | { status: "error" };

export type VerifyCodeDeps = {
  verify: (email: string, code: string) => Promise<{ errorStatus?: number; errorCode?: string }>;
};

export async function verifyLoginCode(
  rawEmail: string,
  rawCode: string,
  deps: VerifyCodeDeps,
): Promise<VerifyCodeResult> {
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return { status: "error" };
  const code = codeSchema.safeParse(rawCode);
  if (!code.success) return { status: "invalid", message: code.error.issues[0].message };

  let result: { errorStatus?: number; errorCode?: string };
  try {
    result = await deps.verify(email.data, code.data);
  } catch {
    return { status: "error" };
  }
  if (!result.errorStatus) return { status: "verified" };
  if (result.errorStatus === 429) return { status: "throttled" };
  if (result.errorCode === "otp_expired") return { status: "expired" };
  if (result.errorStatus === 400 || result.errorStatus === 401 || result.errorStatus === 403)
    return { status: "expired" };
  return { status: "error" };
}

/** Destination après connexion : jamais une URL externe (protection contre les redirections ouvertes). */
export function safeNextPath(next: string | null | undefined, fallback = "/evenements") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.startsWith("/connexion")) return fallback;
  return next;
}
