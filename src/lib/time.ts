/**
 * Gestion du temps : stockage UTC, saisie et affichage en Europe/Zurich.
 * Toutes les conversions « heure murale » <-> instant UTC passent par ce module,
 * ce qui garantit une gestion correcte des changements d'heure (DST).
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays, addMonths, parseISO, format as formatPlain } from "date-fns";

export const CLUB_TZ = "Europe/Zurich";

/** "2026-11-14" pour un instant donné, dans le fuseau du club. */
export function toLocalDateString(d: Date): string {
  return formatInTimeZone(d, CLUB_TZ, "yyyy-MM-dd");
}

/** "08:30" pour un instant donné, dans le fuseau du club. */
export function toLocalTimeString(d: Date): string {
  return formatInTimeZone(d, CLUB_TZ, "HH:mm");
}

/** Convertit une date + heure murales (Zurich) en instant UTC. */
export function fromLocalDateTime(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Date invalide : ${date}`);
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error(`Heure invalide : ${time}`);
  return fromZonedTime(`${date}T${time}:00`, CLUB_TZ);
}

/** Début de journée locale (00:00 Zurich) en UTC. */
export function startOfLocalDay(date: string): Date {
  return fromLocalDateTime(date, "00:00");
}

/** Ajoute n jours à une date "yyyy-MM-dd" (calendrier, indépendamment du fuseau). */
export function addDaysToDateString(date: string, n: number): string {
  return formatPlain(addDays(parseISO(date), n), "yyyy-MM-dd");
}

export function addMonthsToDateString(date: string, n: number): string {
  return formatPlain(addMonths(parseISO(date), n), "yyyy-MM-dd");
}

/**
 * Calcule départ/retour d'une sortie saisie avec une date et deux heures.
 * Si l'heure de retour est antérieure ou égale à l'heure de départ,
 * on considère que la sortie a traversé minuit (retour le lendemain).
 */
export function resolveOutingTimes(
  date: string,
  departureTime: string,
  returnTime: string,
): { departureAt: Date; returnAt: Date; crossesMidnight: boolean } {
  const departureAt = fromLocalDateTime(date, departureTime);
  const crossesMidnight = returnTime <= departureTime;
  const returnDate = crossesMidnight ? addDaysToDateString(date, 1) : date;
  const returnAt = fromLocalDateTime(returnDate, returnTime);
  return { departureAt, returnAt, crossesMidnight };
}

/** Durée en minutes entre deux instants (arrondie à la minute inférieure). */
export function durationMinutes(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 60000);
}

/** "1h30", "45 min", "2h05" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes < 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function formatLocal(d: Date, pattern: string): string {
  return formatInTimeZone(d, CLUB_TZ, pattern);
}

/** "14/11/2026" */
export function formatDate(d: Date): string {
  return formatInTimeZone(d, CLUB_TZ, "dd/MM/yyyy");
}

/** "08:30" */
export function formatTime(d: Date): string {
  return formatInTimeZone(d, CLUB_TZ, "HH:mm");
}

/** "14/11/2026 08:30" */
export function formatDateTime(d: Date): string {
  return formatInTimeZone(d, CLUB_TZ, "dd/MM/yyyy HH:mm");
}

const longDateFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: CLUB_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "samedi 14 novembre 2026" */
export function formatLongDate(d: Date): string {
  return longDateFmt.format(d);
}

const monthFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: "UTC", month: "short", year: "2-digit" });

/** "2026-11" -> "nov. 26" */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 15)));
}
