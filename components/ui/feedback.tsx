import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Message en ligne : erreur, confirmation ou information. */
export function Notice({
  tone,
  title,
  children,
  action,
}: {
  tone: "error" | "success" | "info";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const styles = {
    error: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
    info: "bg-surface text-ink border border-line",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-[12px] px-4 py-3", styles)}>
      <p className="font-[650]">{title}</p>
      {children && <div className="mt-0.5 text-[0.9375rem] text-ink/80">{children}</div>}
      {action && <div className="mt-2.5">{action}</div>}
    </div>
  );
}

/** État vide : dit ce qui manque et propose quoi faire. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[var(--radius-card)] border border-dashed border-line px-5 py-8">
      <svg viewBox="0 0 48 48" className="mb-1 size-10 text-muted" aria-hidden>
        <rect x="5" y="9" width="38" height="34" rx="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M14 4v9M34 4v9M5 19h38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-lg font-[700] text-ink font-narrow">{title}</p>
      {children && <p className="max-w-prose text-[0.9375rem] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Intertitre du fil : « Cette semaine », « Jeudi 17 octobre ». */
export function SectionHeading({ children, as: Tag = "h2" }: { children: ReactNode; as?: "h2" | "h3" }) {
  return <Tag className="text-lg leading-tight font-[700] text-ink font-narrow">{children}</Tag>;
}
