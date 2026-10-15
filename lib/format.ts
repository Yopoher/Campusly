/**
 * Formatage des dates dans le fuseau de l'école (jamais celui du navigateur ou du serveur).
 * Les dates sont stockées en UTC (timestamptz) ; seul l'affichage dépend du fuseau.
 */

export const DEFAULT_TIMEZONE = "Europe/Paris";

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, ...options }).formatToParts(date);
}

function part(date: Date, timeZone: string, type: Intl.DateTimeFormatPartTypes, options: Intl.DateTimeFormatOptions) {
  return parts(date, timeZone, options).find((p) => p.type === type)?.value ?? "";
}

/** Éléments de la colonne de date : « jeu. », « 17 », « oct. » */
export function dateBlockParts(date: Date, timeZone = DEFAULT_TIMEZONE) {
  return {
    weekday: part(date, timeZone, "weekday", { weekday: "short" }),
    day: part(date, timeZone, "day", { day: "numeric" }),
    month: part(date, timeZone, "month", { month: "short" }),
  };
}

/** « 18:30 » */
export function formatTime(date: Date, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
}

/** « 18:30 – 23:00 » ou « 18:30 » */
export function formatTimeRange(start: Date, end: Date | null | undefined, timeZone = DEFAULT_TIMEZONE) {
  return end ? `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}` : formatTime(start, timeZone);
}

/** « jeudi 17 octobre » */
export function formatLongDate(date: Date, timeZone = DEFAULT_TIMEZONE) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(date);
}

/** Texte d'inscriptions : « 12 inscrits », « 1 inscrit », « Personne n'est encore inscrit » */
export function formatParticipants(count: number) {
  if (count === 0) return "Personne n'est encore inscrit";
  return count === 1 ? "1 inscrit" : `${count} inscrits`;
}

/** Places restantes : null si pas de limite */
export function remainingSeats(count: number, capacity: number | null | undefined) {
  if (capacity == null) return null;
  return Math.max(capacity - count, 0);
}

export function formatRemainingSeats(remaining: number) {
  if (remaining === 0) return "Complet";
  return remaining === 1 ? "1 place restante" : `${remaining} places restantes`;
}
