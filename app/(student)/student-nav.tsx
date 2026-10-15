"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/ui/bottom-nav";

/** Barre de navigation de l'espace étudiant. Les notifications arrivent en Phase 6. */
export function StudentNav() {
  const path = usePathname();
  return (
    <BottomNav
      className="sticky bottom-0"
      items={[
        { label: "Événements", icon: "events", href: "/evenements", active: path.startsWith("/evenements") },
        { label: "Profil", icon: "profile", href: "/profil", active: path.startsWith("/profil") },
      ]}
    />
  );
}
