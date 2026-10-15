import { Logo } from "@/components/ui/logo";

// Page d’accueil provisoire : remplacée par la connexion en Phase 3.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Logo size="lg" />
      <h1 className="text-[2rem] leading-tight font-[750] font-narrow">
        Les événements de ton campus, au même endroit.
      </h1>
      <p className="max-w-[48ch] text-lg text-muted">
        Campusly arrive bientôt à Ynov Campus Rouen. Tu pourras t’y connecter avec ton adresse de l’école.
      </p>
    </main>
  );
}
