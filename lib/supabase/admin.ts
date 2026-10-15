import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Client « service » : contourne les règles d'accès. Réservé à trois usages côté serveur
 * (docs/SECURITY.md §1) : contrôle avant envoi d'un code, révocation de sessions, scripts d'administration.
 * Ne jamais l'exposer au navigateur ni s'en servir pour lire des données à afficher.
 */
export function createSupabaseServiceClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  return createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
