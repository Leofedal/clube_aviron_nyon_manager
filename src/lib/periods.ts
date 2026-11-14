/**
 * Périodes de filtrage (tableau de bord, registre, statistiques).
 * Les bornes sont calculées en heure locale Zurich puis converties en UTC.
 * Intervalle semi-ouvert : [from, to[
 */
import {
  addDaysToDateString,
  addMonthsToDateString,
  startOfLocalDay,
  toLocalDateString,
} from "./time";

export const PERIOD_OPTIONS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
  { value: "12m", label: "12 derniers mois" },
  { value: "all", label: "Tout" },
  { value: "custom", label: "Période personnalisée" },
] as const;

export type PeriodKey = (typeof PERIOD_OPTIONS)[number]["value"];

export interface DateRange {
  from: Date;
  to: Date;
  /** Dates locales inclusives, pour l'affichage et les champs de formulaire */
  fromDate: string;
  toDate: string;
}

export interface PeriodInput {
  period?: string | null;
  from?: string | null;
  to?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isPeriodKey(v: unknown): v is PeriodKey {
  return PERIOD_OPTIONS.some((o) => o.value === v);
}

export function rangeFromDates(fromDate: string, toDateInclusive: string): DateRange {
  return {
    from: startOfLocalDay(fromDate),
    to: startOfLocalDay(addDaysToDateString(toDateInclusive, 1)),
    fromDate,
    toDate: toDateInclusive,
  };
}

/** Calcule l'intervalle UTC correspondant à une période, relative à `now`. */
export function resolvePeriod(
  input: PeriodInput,
  fallback: PeriodKey = "month",
  now: Date = new Date(),
): DateRange & { period: PeriodKey } {
  const period: PeriodKey = isPeriodKey(input.period) ? input.period : fallback;
  const today = toLocalDateString(now);

  switch (period) {
    case "today":
      return { period, ...rangeFromDates(today, today) };
    case "7d":
      return { period, ...rangeFromDates(addDaysToDateString(today, -6), today) };
    case "30d":
      return { period, ...rangeFromDates(addDaysToDateString(today, -29), today) };
    case "month": {
      const first = `${today.slice(0, 7)}-01`;
      const last = addDaysToDateString(addMonthsToDateString(first, 1), -1);
      return { period, ...rangeFromDates(first, last) };
    }
    case "year": {
      const y = today.slice(0, 4);
      return { period, ...rangeFromDates(`${y}-01-01`, `${y}-12-31`) };
    }
    case "12m": {
      const first = addMonthsToDateString(`${today.slice(0, 7)}-01`, -11);
      return { period, ...rangeFromDates(first, today) };
    }
    case "all":
      return { period, ...rangeFromDates("2000-01-01", addDaysToDateString(today, 1)) };
    case "custom": {
      let from = input.from && DATE_RE.test(input.from) ? input.from : today;
      let to = input.to && DATE_RE.test(input.to) ? input.to : today;
      if (from > to) [from, to] = [to, from];
      return { period, ...rangeFromDates(from, to) };
    }
  }
}

export function periodLabel(period: PeriodKey): string {
  return PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "";
}
