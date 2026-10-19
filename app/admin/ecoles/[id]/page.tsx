import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireSuperAdmin } from "@/app/admin/access";
import {
  MemberForm,
  OrganizationEditForm,
  OrganizationForm,
  DeleteOrganizationForm,
  DeleteSchoolForm,
  SchoolEditForm,
  SchoolStatusForm,
} from "@/app/admin/back-office-forms";
import { EVENT_PERMISSIONS, ORG_TYPES } from "@/lib/admin/forms";

export const metadata: Metadata = { title: "École", robots: { index: false } };

type Org = { id: string; name: string; type: string; status: string; description: string | null };
type Member = {
  id: string;
  organization_id: string;
  profiles: { first_name: string; last_name: string; email: string } | null;
  organization_member_permissions: { permission: string }[];
};

const typeLabel = (value: string) => ORG_TYPES.find((t) => t.value === value)?.label ?? value;
const permissionLabel = (value: string) => EVENT_PERMISSIONS.find((p) => p.value === value)?.label ?? value;

async function SchoolContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const supabase = await requireSuperAdmin();

  const { data: school } = await supabase
    .from("schools")
    .select("id, name, status, timezone")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string; status: string; timezone: string }>();
  if (!school) notFound();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, type, status, description")
    .eq("school_id", id)
    .order("name")
    .returns<Org[]>();

  const { data: members } = await supabase
    .from("organization_members")
    .select("id, organization_id, profiles(first_name, last_name, email), organization_member_permissions(permission)")
    .eq("school_id", id)
    .returns<Member[]>();

  const { data: domainRows } = await supabase
    .from("school_domains")
    .select("domain")
    .eq("school_id", id)
    .order("domain");
  const domains = ((domainRows ?? []) as { domain: string }[]).map((d) => d.domain);

  const { count: allowedCount } = await supabase
    .from("allowed_emails")
    .select("id", { count: "exact", head: true })
    .eq("school_id", id)
    .eq("status", "authorized");
  const { data: allowed } = await supabase
    .from("allowed_emails")
    .select("email, person_type, first_name, last_name, cohort")
    .eq("school_id", id)
    .eq("status", "authorized")
    .order("email")
    .limit(200)
    .returns<
      {
        email: string;
        person_type: string;
        first_name: string | null;
        last_name: string | null;
        cohort: string | null;
      }[]
    >();

  return (
    <>
      <Link href="/admin" className="text-sm text-muted underline">
        ← Retour aux écoles
      </Link>
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-[700] font-narrow">{school.name}</h2>
        <p className="text-sm text-muted">
          {school.status === "active" ? "Active" : "Désactivée"} · {school.timezone} · {domains.join(", ")}
        </p>
      </section>

      <details className="rounded-[var(--radius-card)] bg-surface p-5">
        <summary className="cursor-pointer font-[600]">Modifier ou désactiver l’école</summary>
        <div className="flex flex-col gap-6 pt-4">
          <SchoolEditForm school={school} domains={domains} />
          <SchoolStatusForm schoolId={school.id} status={school.status as "active" | "disabled"} />
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <h4 className="font-[600]">Supprimer l’école</h4>
            <DeleteSchoolForm schoolId={school.id} />
          </div>
        </div>
      </details>

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-[700] font-narrow">Organisations</h3>
        {(orgs ?? []).length === 0 && <p className="text-muted">Aucune organisation pour l’instant.</p>}
        {(orgs ?? []).map((org) => {
          const orgMembers = (members ?? []).filter((m) => m.organization_id === org.id);
          return (
            <article key={org.id} className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5">
              <header className="flex flex-col gap-1">
                <h4 className="text-base font-[700]">{org.name}</h4>
                <p className="text-sm text-muted">
                  {typeLabel(org.type)} · {org.status === "active" ? "Active" : "Désactivée"}
                </p>
              </header>
              {orgMembers.length === 0 ? (
                <p className="text-sm text-muted">Aucun membre.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {orgMembers.map((m) => (
                    <li key={m.id} className="flex flex-col gap-1 py-2">
                      <span className="font-[600]">
                        {m.profiles
                          ? `${m.profiles.first_name} ${m.profiles.last_name}`.trim() || m.profiles.email
                          : "Compte inconnu"}
                      </span>
                      <span className="text-sm text-muted">{m.profiles?.email}</span>
                      <span className="text-sm">
                        {m.organization_member_permissions.length
                          ? m.organization_member_permissions.map((p) => permissionLabel(p.permission)).join(" · ")
                          : "Aucune permission d’événements"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <details>
                <summary className="cursor-pointer font-[600]">Modifier l’organisation</summary>
                <div className="flex flex-col gap-6 pt-4">
                  <OrganizationEditForm schoolId={school.id} org={org} />
                  <DeleteOrganizationForm schoolId={school.id} organizationId={org.id} />
                </div>
              </details>
              <details>
                <summary className="cursor-pointer font-[600]">Ajouter un membre</summary>
                <div className="pt-4">
                  <MemberForm schoolId={school.id} organizationId={org.id} />
                </div>
              </details>
            </article>
          );
        })}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-[700] font-narrow">Adresses autorisées ({allowedCount ?? 0})</h3>
          <Link href={`/admin/ecoles/${school.id}/import`} className="font-[600] underline">
            Importer une liste (CSV)
          </Link>
        </div>
        {(allowed ?? []).length === 0 ? (
          <p className="text-muted">Aucune adresse autorisée pour l’instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] bg-surface">
            {(allowed ?? []).map((a) => (
              <li key={a.email} className="flex flex-col gap-0.5 px-4 py-3">
                <span className="font-[600]">{a.email}</span>
                <span className="text-sm text-muted">
                  {[
                    `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
                    a.person_type === "staff" ? "Personnel" : "Étudiant",
                    a.cohort,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(allowedCount ?? 0) > 200 && <p className="text-sm text-muted">Les 200 premières adresses sont affichées.</p>}
      </section>

      <OrganizationForm schoolId={school.id} />
    </>
  );
}

export default function SchoolPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-1 flex-col gap-8 px-5 py-10 sm:px-8">
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <SchoolContent params={params} />
      </Suspense>
    </main>
  );
}
