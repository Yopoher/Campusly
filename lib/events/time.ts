import { DEFAULT_TIMEZONE } from "@/lib/format";

/**
 * Conversion d'une date saisie (« 2026-10-24T18:30 », heure de l'école) en instant UTC.
 * Le navigateur n'envoie jamais de fuseau : l'heure saisie est toujours celle de l'école.
 * Renvoie null si la saisie est invalide ou n'existe pas (ex. 30 février, heure sautée au changement d'heure).
 */
export function zonedLocalToUtc(value: string, timeZone = DEFAULT_TIMEZONE): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);

  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wallClock);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return null;
  }

  // Décalage du fuseau à cet instant, puis une seconde passe pour les transitions d'heure d'été.
  let utc = wallClock - tzOffsetMs(new Date(wallClock), timeZone);
  const corrected = wallClock - tzOffsetMs(new Date(utc), timeZone);
  if (corrected !== utc) utc = corrected;

  // Heure inexistante (saut de l'heure d'été) : l'heure de sortie ne correspond pas à la saisie.
  if (wallClockIn(new Date(utc), timeZone) !== wallClock) return null;
  return new Date(utc);
}

/** Date saisie au format attendu par <input type="datetime-local"> (« 2026-10-24T18:30 »), dans le fuseau donné. */
export function utcToZonedLocal(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const p = partsIn(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function wallClockIn(date: Date, timeZone: string) {
  const p = partsIn(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
}

function tzOffsetMs(date: Date, timeZone: string) {
  // Les décalages des fuseaux sont en minutes entières : on ramène l'instant à la minute.
  const minuteStart = Math.floor(date.getTime() / 60_000) * 60_000;
  return wallClockIn(date, timeZone) - minuteStart;
}
