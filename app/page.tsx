import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Logo size="lg" />
      <h1 className="text-[2rem] leading-tight font-[750] font-narrow">
        Les événements de ton campus, au même endroit.
      </h1>
      <p className="max-w-[48ch] text-lg text-muted">
        Job datings, soirées du BDE, conférences : découvre ce qui se passe à l’école, inscris-toi et discute avec les
        autres participants.
      </p>
      <Link
        href="/connexion"
        className="inline-flex min-h-12 w-fit items-center rounded-[var(--radius-control)] bg-ink px-5 font-[620] text-paper hover:opacity-90"
      >
        Me connecter
      </Link>
    </main>
  );
}
