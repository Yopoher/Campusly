import { cn } from "@/lib/cn";

export type OrgType = "school" | "direction" | "pedagogy" | "bde" | "association" | "other";

export const ORG_COLOR: Record<OrgType, string> = {
  bde: "var(--c-org-bde)",
  association: "var(--c-org-association)",
  pedagogy: "var(--c-org-pedagogy)",
  school: "var(--c-org-school)",
  direction: "var(--c-org-school)",
  other: "var(--c-org-other)",
};

/** Nom de l'organisation précédé d'une pastille de sa couleur (la couleur indique le type d'organisateur). */
export function OrgBadge({ name, type, className }: { name: string; type: OrgType; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-sm font-[600] text-ink", className)}>
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ORG_COLOR[type] }} />
      <span className="truncate">{name}</span>
    </span>
  );
}
