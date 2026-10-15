/**
 * Invite le super-administrateur de Campusly.
 *
 * Usage : node scripts/invite-admin.ts prenom.nom@exemple.fr
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * L'adresse invitée pourra demander un code de connexion même si elle ne figure dans la liste
 * d'aucune école. À la première connexion, le compte devient super-administrateur et l'invitation
 * est consommée ; il devra ensuite configurer son second facteur sur /admin.
 * Aucun mot de passe n'est créé ni stocké.
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
  console.error("Indique l'adresse à inviter : node scripts/invite-admin.ts prenom.nom@exemple.fr");
  process.exit(1);
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await supabase.rpc("invite_platform_admin", { p_email: email });
if (error) {
  console.error(`Invitation impossible : ${error.message}`);
  process.exit(1);
}
console.log(`Invitation enregistrée. Connecte-toi avec ${email} sur /connexion, puis ouvre /admin.`);
