import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/ui/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-8 px-5 py-12">
      <Logo size="md" />
      <div className="flex flex-col gap-2">
        <h1 className="text-[1.75rem] leading-tight font-[750] font-narrow">Connexion</h1>
        <p className="text-muted">
          Saisis l’adresse e-mail que t’a donnée ton école. Tu recevras un code pour te connecter.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
