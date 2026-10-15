/* Campusly — service worker.
 * Phase 2 : socle minimal (installation et mise à jour immédiates, aucun cache).
 * Phase 6 : réception des notifications push et ouverture de la bonne page au clic.
 * Volontairement sans mise en cache des pages : les données de l'école ne doivent jamais
 * être servies périmées ni rester sur un appareil après déconnexion.
 */
const SW_VERSION = "2026-10-15.1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data === "version") event.source?.postMessage({ version: SW_VERSION });
});
