import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../actions";

export const metadata: Metadata = { title: "Accès impossible" };

export default function AccessRefusedPage() {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-6 px-5 py-12">
      <Logo size="md" />
      <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Ton compte n’a pas accès à Campusly</h1>
      <p className="text-muted">
        Ton adresse n’est pas, ou plus, sur la liste de ton école, ou ton compte a été désactivé. Si tu penses que c’est
        une erreur, contacte le service de vie étudiante de ton campus.
      </p>
      <form action={signOutAction}>
        <Button type="submit" variant="secondary">
          Me déconnecter
        </Button>
      </form>
    </main>
  );
}
