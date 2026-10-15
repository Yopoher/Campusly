import { cn } from "@/lib/cn";

/**
 * Logo provisoire : une page d'agenda (deux anneaux de reliure) dont la date est surlignée.
 * Le mot « campusly » est composé en Archivo condensé.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="4" y="8" width="40" height="36" rx="9" fill="var(--c-ink)" />
      <rect x="12" y="3" width="5" height="11" rx="2.5" fill="var(--c-ink)" stroke="var(--c-paper)" strokeWidth="2" />
      <rect x="31" y="3" width="5" height="11" rx="2.5" fill="var(--c-ink)" stroke="var(--c-paper)" strokeWidth="2" />
      <rect x="11" y="21" width="26" height="14" rx="3" fill="var(--c-marker)" />
      <rect x="11" y="38" width="16" height="2.5" rx="1.25" fill="var(--c-paper)" opacity="0.55" />
    </svg>
  );
}

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { mark: "size-6", text: "text-lg" },
    md: { mark: "size-8", text: "text-2xl" },
    lg: { mark: "size-12", text: "text-4xl" },
  }[size];
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark className={sizes.mark} />
      <span className={cn("leading-none font-[800] tracking-[-0.01em] font-condensed", sizes.text)}>campusly</span>
    </span>
  );
}
