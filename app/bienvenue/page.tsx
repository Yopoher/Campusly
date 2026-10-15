import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { ProfileForm } from "../(student)/profile-form";

export const metadata: Metadata = { title: "Bienvenue" };

async function WelcomeForm() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (!user.profile || user.profile.status !== "active") redirect("/connexion/acces-refuse");
  return <ProfileForm defaults={user.profile} onboarding />;
}

export default function WelcomePage() {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-8 px-5 py-12">
      <Logo size="md" />
      <div className="flex flex-col gap-2">
        <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Bienvenue sur Campusly</h1>
        <p className="text-muted">
          Vérifie ton prénom et ton nom : c’est ainsi que les autres étudiants te verront dans la liste des
          participants.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <WelcomeForm />
      </Suspense>
    </main>
  );
}
