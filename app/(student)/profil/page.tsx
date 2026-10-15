import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { requireStudent } from "@/lib/auth/session";
import { signOutAction } from "@/app/connexion/actions";
import { ProfileForm } from "../profile-form";

export const metadata: Metadata = { title: "Profil" };

async function ProfileContent() {
  const { profile, email } = await requireStudent("/profil");
  return (
    <>
      <p className="text-muted">
        Connecté·e avec <span className="font-[600] text-ink">{email}</span>. Ton adresse n’est jamais visible par les
        autres étudiants.
      </p>
      <ProfileForm defaults={profile} />
    </>
  );
}

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Profil</h1>
      <Suspense fallback={<p className="text-muted">Chargement du profil…</p>}>
        <ProfileContent />
      </Suspense>
      <form action={signOutAction} className="border-t border-line pt-6">
        <Button type="submit" variant="secondary">
          Me déconnecter
        </Button>
      </form>
    </div>
  );
}
