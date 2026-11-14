import { resolvePeriod, type DateRange, type PeriodKey } from "@/lib/periods";
import {
  REGISTRY_SORTS,
  REGISTRY_STATUS_FILTERS,
  type RegistryFilters,
  type RegistrySort,
  type RegistryStatusFilter,
} from "@/lib/services/outing-queries";

export type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Paramètres d'URL (français) → filtres du registre. Partagé par la page et l'export CSV. */
export function parseRegistryParams(sp: RawParams): RegistryFilters & { period: PeriodKey | "" } {
  const sort = one(sp.tri) as RegistrySort;
  const status = one(sp.statut) as RegistryStatusFilter;
  const periodRaw = one(sp.periode);
  let range: DateRange | null = null;
  let period: PeriodKey | "" = "";
  if (periodRaw) {
    const r = resolvePeriod({ period: periodRaw, from: one(sp.du), to: one(sp.au) }, "all");
    if (r.period !== "all") {
      range = r;
      period = r.period;
    }
  }
  return {
    q: one(sp.q).slice(0, 100) || undefined,
    boatId: one(sp.bateau) || undefined,
    memberId: one(sp.membre) || undefined,
    status: REGISTRY_STATUS_FILTERS.includes(status) ? status : "",
    sort: REGISTRY_SORTS.includes(sort) ? sort : "date",
    dir: one(sp.ordre) === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(one(sp.page) || "1", 10) || 1),
    pageSize: 25,
    range,
    period,
  };
}
