import { z } from "zod";

/**
 * Variables d'environnement, validées à la première utilisation.
 * Les messages d'erreur disent quoi configurer, sans jamais afficher de valeur.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL doit être l'URL du projet Supabase" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY manquante"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY manquante (côté serveur uniquement)"),
});

function format(error: z.ZodError) {
  return error.issues.map((i) => `- ${i.message}`).join("\n");
}

export function publicEnv() {
  // Accès explicites : Next.js ne remplace que les références littérales aux variables NEXT_PUBLIC_.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  });
  if (!parsed.success) throw new Error(`Configuration incomplète (voir .env.example) :\n${format(parsed.error)}`);
  return parsed.data;
}

export function serverEnv() {
  const parsed = serverSchema.safeParse({ SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY });
  if (!parsed.success) throw new Error(`Configuration incomplète (voir .env.example) :\n${format(parsed.error)}`);
  return parsed.data;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
