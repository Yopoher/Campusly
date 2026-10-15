import Link from "next/link";
import { cn } from "@/lib/cn";

export type NavItem = {
  label: string;
  icon: "events" | "notifications" | "profile";
  /** Lien de destination ; sans lien, l'élément est affiché sans être cliquable (aperçu). */
  href?: string;
  active?: boolean;
  badge?: number;
};

const icons: Record<NavItem["icon"], React.ReactNode> = {
  events: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  notifications: (
    <path
      d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2H4.5l1.5-2ZM10 21h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  ),
  profile: (
    <>
      <circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
};

/** Barre de navigation inférieure de l'espace étudiant. */
export function BottomNav({ items, className }: { items: NavItem[]; className?: string }) {
  return (
    <nav aria-label="Navigation principale" className={cn("border-t border-line bg-surface", className)}>
      <ul className="mx-auto flex max-w-[640px] pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const content = (
            <>
              <span className="relative">
                <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                  {icons[item.icon]}
                </svg>
                {item.badge ? (
                  <span className="absolute -top-1 -right-2 min-w-[1.125rem] rounded-full bg-danger px-1 text-center text-[0.6875rem] leading-[1.125rem] font-[700] text-white">
                    {item.badge > 9 ? "9+" : item.badge}
                    <span className="sr-only"> non lues</span>
                  </span>
                ) : null}
              </span>
              <span className={cn("text-xs", item.active ? "font-[700]" : "font-[550]")}>{item.label}</span>
            </>
          );
          const cls = cn(
            "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5",
            item.active ? "text-ink" : "text-muted",
          );
          return (
            <li key={item.label} className="flex flex-1">
              {item.href ? (
                <Link href={item.href} aria-current={item.active ? "page" : undefined} className={cls}>
                  {content}
                </Link>
              ) : (
                <span aria-current={item.active ? "page" : undefined} className={cls}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
