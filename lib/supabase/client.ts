import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase côté navigateur.
 * Utilise les cookies gérés automatiquement par @supabase/ssr.
 * Seule la clé publique (anon) est utilisée : pas de secret côté client.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
