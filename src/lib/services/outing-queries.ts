import { Prisma, type OutingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/periods";

export const REGISTRY_SORTS = ["date", "boat", "direction", "departure", "return", "duration", "km", "status"] as const;
export type RegistrySort = (typeof REGISTRY_SORTS)[number];
export const REGISTRY_STATUS_FILTERS = ["", "IN_PROGRESS", "COMPLETED", "CANCELLED", "ALL"] as const;
export type RegistryStatusFilter = (typeof REGISTRY_STATUS_FILTERS)[number];

export interface RegistryFilters {
  q?: string;
  boatId?: string;
  memberId?: string;
  direction?: "GENEVA" | "LAUSANNE";
  status?: RegistryStatusFilter;
  range?: DateRange | null;
  sort?: RegistrySort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

const outingInclude = {
  boat: { include: { boatType: true } },
  crew: {
    include: { user: { select: { id: true, firstName: true, lastName: true, isActive: true } } },
    orderBy: [{ crewRole: "desc" as const }, { seat: "asc" as const }],
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.OutingInclude;

export type OutingWithDetails = Prisma.OutingGetPayload<{ include: typeof outingInclude }>;

/** Équipage trié : rameurs (par nom) puis barreur. */
export function sortCrew<T extends { crewRole: string; user: { lastName: string; firstName: string } }>(crew: T[]): T[] {
  return [...crew].sort((a, b) => {
    if (a.crewRole !== b.crewRole) return a.crewRole === "ROWER" ? -1 : 1;
    return a.user.firstName.localeCompare(b.user.firstName, "fr");
  });
}

function buildWhere(f: RegistryFilters): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  const status = f.status ?? "";
  if (status === "") conds.push(Prisma.sql`o."status" <> 'CANCELLED'`);
  else if (status !== "ALL") conds.push(Prisma.sql`o."status" = ${status}::"OutingStatus"`);
  if (f.boatId) conds.push(Prisma.sql`o."boatId" = ${f.boatId}`);
  if (f.direction) conds.push(Prisma.sql`o."direction" = ${f.direction}::"OutingDirection"`);
  if (f.memberId)
    conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "OutingCrew" c WHERE c."outingId" = o.id AND c."userId" = ${f.memberId})`);
  if (f.range) {
    conds.push(Prisma.sql`o."departureAt" >= ${f.range.from} AND o."departureAt" < ${f.range.to}`);
  }
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    conds.push(Prisma.sql`(
      b."name" ILIKE ${like}
      OR COALESCE(o."notes", '') ILIKE ${like}
      OR EXISTS (
        SELECT 1 FROM "OutingCrew" c JOIN "User" u ON u.id = c."userId"
        WHERE c."outingId" = o.id
          AND (u."firstName" || ' ' || u."lastName" ILIKE ${like} OR u."lastName" || ' ' || u."firstName" ILIKE ${like})
      )
    )`);
  }
  return conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty;
}

function buildOrder(sort: RegistrySort, dir: "asc" | "desc"): Prisma.Sql {
  const d = dir === "asc" ? Prisma.raw("ASC") : Prisma.raw("DESC");
  const nulls = Prisma.raw("NULLS LAST");
  const expr: Record<RegistrySort, Prisma.Sql> = {
    date: Prisma.sql`o."departureAt"`,
    departure: Prisma.sql`(o."departureAt" AT TIME ZONE 'Europe/Zurich')::time`,
    return: Prisma.sql`o."returnAt"`,
    boat: Prisma.sql`b."name"`,
    direction: Prisma.sql`o."direction"`,
    duration: Prisma.sql`(o."returnAt" - o."departureAt")`,
    km: Prisma.sql`o."distanceKm"`,
    status: Prisma.sql`o."status"`,
  };
  return Prisma.sql`ORDER BY ${expr[sort]} ${d} ${nulls}, o."departureAt" DESC, o.id`;
}

/** Registre : liste filtrée, triée et paginée. */
export async function listOutings(f: RegistryFilters) {
  const pageSize = Math.min(Math.max(f.pageSize ?? 25, 5), 100);
  const page = Math.max(f.page ?? 1, 1);
  const where = buildWhere(f);
  const order = buildOrder(f.sort ?? "date", f.dir ?? "desc");

  const rows = await prisma.$queryRaw<{ id: string; total: bigint }[]>`
    SELECT o.id, COUNT(*) OVER() AS total
    FROM "Outing" o JOIN "Boat" b ON b.id = o."boatId"
    ${where}
    ${order}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

  const total = rows.length ? Number(rows[0].total) : await countOutings(where);
  const items = await fetchOrdered(rows.map((r) => r.id));
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

async function countOutings(where: Prisma.Sql) {
  const r = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "Outing" o JOIN "Boat" b ON b.id = o."boatId" ${where}`;
  return Number(r[0]?.n ?? 0);
}

async function fetchOrdered(ids: string[]): Promise<OutingWithDetails[]> {
  if (!ids.length) return [];
  const list = await prisma.outing.findMany({ where: { id: { in: ids } }, include: outingInclude });
  const byId = new Map(list.map((o) => [o.id, o]));
  return ids.map((id) => byId.get(id)!).filter(Boolean);
}

/** Toutes les sorties correspondant aux filtres (export CSV), limité par sécurité. */
export async function listOutingsForExport(f: RegistryFilters, limit = 20000) {
  const where = buildWhere(f);
  const order = buildOrder(f.sort ?? "date", f.dir ?? "desc");
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT o.id FROM "Outing" o JOIN "Boat" b ON b.id = o."boatId" ${where} ${order} LIMIT ${limit}`;
  const items: OutingWithDetails[] = [];
  for (let i = 0; i < rows.length; i += 1000) {
    items.push(...(await fetchOrdered(rows.slice(i, i + 1000).map((r) => r.id))));
  }
  return items;
}

export function getOuting(id: string) {
  return prisma.outing.findUnique({ where: { id }, include: outingInclude });
}

export function getActiveOutings() {
  return prisma.outing.findMany({
    where: { status: "IN_PROGRESS" },
    include: outingInclude,
    orderBy: { departureAt: "asc" },
  });
}

export function getRecentCompletedOutings(take = 8) {
  return prisma.outing.findMany({
    where: { status: "COMPLETED" },
    include: outingInclude,
    orderBy: { returnAt: "desc" },
    take,
  });
}

export function getOutingAudit(outingId: string) {
  return prisma.auditLog.findMany({
    where: { entityType: "Outing", entityId: outingId },
    include: { actor: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export const STATUS_LABELS: Record<OutingStatus, string> = {
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};
