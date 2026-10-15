import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Client Supabase agissant au nom de l'utilisateur connecté (clé publique + session en cookies).
 * Toutes les règles d'accès s'appliquent (RLS). À créer à chaque requête, jamais partagé.
 */
export async function createSupabaseServerClient() {
  // Lire les cookies d'abord : cela marque le rendu comme dynamique avant tout accès à la configuration.
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Appel depuis un composant serveur : le proxy se charge de renouveler la session.
        }
      },
    },
  });
}
