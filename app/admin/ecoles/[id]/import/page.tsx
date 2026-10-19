import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireSuperAdmin } from "@/app/admin/access";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Importer une liste", robots: { index: false } };

async function ImportContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const supabase = await requireSuperAdmin();
  const { data: school } = await supabase
    .from("schools")
    .select("id, name")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string }>();
  if (!school) notFound();

  return (
    <>
      <Link href={`/admin/ecoles/${school.id}`} className="text-sm text-muted underline">
        ← Retour à {school.name}
      </Link>
      <h1 className="text-xl font-[700] font-narrow">Importer une liste d’étudiants</h1>
      <ImportForm schoolId={school.id} />
    </>
  );
}

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <ImportContent params={params} />
      </Suspense>
    </main>
  );
}
