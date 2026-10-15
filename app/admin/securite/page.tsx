import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { Enroll } from "./enroll";

export const metadata: Metadata = { title: "Double authentification", robots: { index: false } };

export default function AdminSecurityPage() {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center gap-6 px-5 py-12">
      <Logo size="md" />
      <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Protéger le compte administrateur</h1>
      <p className="text-muted">
        Ce compte peut gérer les écoles, les listes d’étudiants et les permissions. Un second facteur est obligatoire :
        en plus du code reçu par e-mail, tu saisiras à chaque connexion un code généré par ton téléphone.
      </p>
      <Enroll />
    </main>
  );
}
