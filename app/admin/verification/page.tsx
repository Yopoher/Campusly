import type { Metadata } from "next";
import { Logo } from "@/components/ui/logo";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Vérification", robots: { index: false } };

export default function AdminVerificationPage() {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-6 px-5 py-12">
      <Logo size="md" />
      <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Second facteur</h1>
      <p className="text-muted">Saisis le code affiché par ton application d’authentification.</p>
      <VerifyForm />
    </main>
  );
}
