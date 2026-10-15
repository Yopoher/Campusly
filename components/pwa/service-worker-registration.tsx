"use client";

import { useEffect } from "react";

/** Enregistre le service worker en production (nécessaire à l'installation et aux notifications). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sans service worker, l'application reste utilisable ; seules l'installation et le push sont affectés.
    });
  }, []);
  return null;
}
