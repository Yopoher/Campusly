"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Theme = "system" | "light" | "dark";
const labels: Record<Theme, string> = { system: "Système", light: "Clair", dark: "Sombre" };

/** Bascule de thème pour la page de démonstration (non mémorisée). */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    return () => root.removeAttribute("data-theme");
  }, [theme]);

  return (
    <div role="radiogroup" aria-label="Thème d’affichage" className="inline-flex rounded-[10px] bg-surface p-1">
      {(Object.keys(labels) as Theme[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => setTheme(t)}
          className={cn(
            "min-h-10 rounded-[7px] px-3.5 text-sm font-[600] transition-colors",
            theme === t ? "bg-ink text-paper" : "text-muted hover:text-ink",
          )}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  );
}
