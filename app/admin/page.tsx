import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/connexion/actions";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

type SchoolRow = { id: string; name: string; status: "active" | "disabled"; timezone: string };

/** Accès : super-admin avec second facteur vérifié dans cette session (aal2). */
async function AdminContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/admin");
  if (!user.isPlatformAdmin) redirect("/");

  const supabase = await createSupabaseServerClient();
  if (user.aal !== "aal2") {
    const { data } = await supabase.auth.mfa.listFactors();
    redirect(data?.totp.some((f) => f.status === "verified") ? "/admin/verification" : "/admin/securite");
  }

  const { data: schools } = await supabase.from("schools").select("id, name, status, timezone").order("name");
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-[700] font-narrow">Écoles</h2>
      {schools?.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] bg-surface">
          {(schools as SchoolRow[]).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="font-[600]">{s.name}</span>
              <span className="text-sm text-muted">{s.status === "active" ? "Active" : "Désactivée"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Aucune école pour l’instant">
          La création des écoles, des organisations et l’import des listes depuis cette interface arrivent en Phase 7.
        </EmptyState>
      )}
    </section>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="text-sm text-muted">Administration</span>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Me déconnecter
          </Button>
        </form>
      </header>
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
