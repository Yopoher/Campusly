/**
 * DÉVELOPPEMENT UNIQUEMENT : autorise une adresse dans l'école de démonstration
 * (« Ynov Campus Rouen (démo) », créée par supabase/seed.sql), pour tester la connexion.
 *
 * Usage : node scripts/dev-allow-email.ts prenom.nom@ynov.com
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Refuse de s'exécuter si l'école de démonstration n'existe pas (protection contre un usage en production).
 */
import { createClient } from "@supabase/supabase-js";

const DEMO_SCHOOL_SLUG = "ynov-rouen-demo";
const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
  console.error("Indique l'adresse à autoriser : node scripts/dev-allow-email.ts prenom.nom@ynov.com");
  process.exit(1);
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: school, error: schoolError } = await supabase
  .from("schools")
  .select("id")
  .eq("slug", DEMO_SCHOOL_SLUG)
  .maybeSingle();
if (schoolError || !school) {
  console.error("École de démonstration introuvable : relance le déploiement avec « include_seed » coché.");
  process.exit(1);
}

const { error } = await supabase
  .from("allowed_emails")
  .upsert(
    { school_id: school.id, email, person_type: "staff", status: "authorized" },
    { onConflict: "school_id,email" },
  );
if (error) {
  console.error(`Autorisation impossible : ${error.message}`);
  process.exit(1);
}
console.log(`${email} peut maintenant demander un code de connexion (école de démonstration).`);
