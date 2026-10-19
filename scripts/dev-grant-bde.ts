/**
 * DÉVELOPPEMENT UNIQUEMENT : donne à une personne déjà connectée une fois le rôle de responsable
 * d'événements du BDE de l'école de démonstration (« Ynov Campus Rouen (démo) », créée par supabase/seed.sql).
 * Permissions accordées : créer, modifier, annuler les événements et discuter au nom du BDE.
 *
 * Usage : node scripts/dev-grant-bde.ts prenom.nom@ynov.com
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Refuse de s'exécuter si l'école de démonstration n'existe pas (protection contre un usage en production).
 */
import { createClient } from "@supabase/supabase-js";

const DEMO_SCHOOL_SLUG = "ynov-rouen-demo";
const DEMO_BDE_ID = "a2000000-0000-0000-0000-000000000000";
const PERMISSIONS = ["events.create", "events.edit", "events.cancel", "events.chat"] as const;

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
  console.error("Indique l'adresse concernée : node scripts/dev-grant-bde.ts prenom.nom@ynov.com");
  process.exit(1);
}
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function fail(step: string, message: string | undefined): never {
  console.error(`${step} : ${message ?? "erreur inconnue"}`);
  process.exit(1);
}

const { data: school, error: schoolError } = await supabase
  .from("schools")
  .select("id")
  .eq("slug", DEMO_SCHOOL_SLUG)
  .maybeSingle();
if (schoolError || !school) fail("École de démonstration introuvable", schoolError?.message);

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id")
  .eq("school_id", school.id)
  .eq("email", email)
  .maybeSingle();
if (profileError) fail("Lecture du compte", profileError.message);
if (!profile) {
  console.error(`Aucun compte pour ${email} : la personne doit d'abord se connecter une fois sur le site.`);
  process.exit(1);
}

const { data: member, error: memberError } = await supabase
  .from("organization_members")
  .upsert(
    { organization_id: DEMO_BDE_ID, school_id: school.id, user_id: profile.id },
    { onConflict: "organization_id,user_id" },
  )
  .select("id")
  .single();
if (memberError || !member) fail("Ajout au BDE", memberError?.message);

const { error: deleteError } = await supabase
  .from("organization_member_permissions")
  .delete()
  .eq("member_id", member.id);
if (deleteError) fail("Remise à zéro des permissions", deleteError.message);

const { error: insertError } = await supabase
  .from("organization_member_permissions")
  .insert(PERMISSIONS.map((permission) => ({ member_id: member.id, permission })));
if (insertError) fail("Attribution des permissions", insertError.message);

console.log(`${email} est responsable d'événements du BDE (école de démonstration).`);
