/**
 * Statistiques — toujours calculées à partir des sorties, jamais stockées.
 *
 * Règles :
 *  - seules les sorties au statut COMPLETED comptent (ni en cours, ni annulées) ;
 *  - une sortie compte une seule fois dans les kilomètres du club et du bateau ;
 *  - chaque membre de l'équipage se voit attribuer la distance totale de la sortie ;
 *  - une sortie est attribuée à une période selon sa date/heure de départ (Europe/Zurich) ;
 *  - LIVE et RETROSPECTIVE sont traités de façon identique.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DateRange } from "@/lib/periods";
import { addMonthsToDateString } from "@/lib/time";

const num = (v: unknown): number => (v == null ? 0 : Number(v));

const inRange = (r?: DateRange | null) =>
  r ? Prisma.sql`AND o."departureAt" >= ${r.from} AND o."departureAt" < ${r.to}` : Prisma.empty;

export interface ClubSummary {
  outings: number;
  km: number;
  activeRowers: number;
  minutes: number;
}

export async function getClubSummary(range?: DateRange | null): Promise<ClubSummary> {
  const [row] = await prisma.$queryRaw<{ outings: bigint; km: Prisma.Decimal | null; minutes: number | null }[]>`
    SELECT COUNT(*) AS outings,
           COALESCE(SUM(o."distanceKm"), 0) AS km,
           COALESCE(SUM(EXTRACT(EPOCH FROM (o."returnAt" - o."departureAt")) / 60), 0)::float8 AS minutes
    FROM "Outing" o
    WHERE o."status" = 'COMPLETED' ${inRange(range)}`;
  const [rowers] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(DISTINCT c."userId") AS n
    FROM "OutingCrew" c JOIN "Outing" o ON o.id = c."outingId"
    WHERE o."status" = 'COMPLETED' ${inRange(range)}`;
  return {
    outings: num(row?.outings),
    km: num(row?.km),
    minutes: Math.round(num(row?.minutes)),
    activeRowers: num(rowers?.n),
  };
}

export function countBoatsOnWater() {
  return prisma.outing.count({ where: { status: "IN_PROGRESS" } });
}

export interface MonthlyPoint {
  month: string; // "2026-11"
  km: number;
  outings: number;
  activeRowers: number;
}

/** Liste des mois "YYYY-MM" couverts par l'intervalle (bornes locales). */
export function monthsInRange(range: DateRange, max = 60): string[] {
  const out: string[] = [];
  let cur = `${range.fromDate.slice(0, 7)}-01`;
  const end = range.toDate.slice(0, 7);
  while (cur.slice(0, 7) <= end && out.length < max) {
    out.push(cur.slice(0, 7));
    cur = addMonthsToDateString(cur, 1);
  }
  return out;
}

export async function getMonthlySeries(range: DateRange, opts: { userId?: string; boatId?: string } = {}) {
  const userFilter = opts.userId
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM "OutingCrew" c2 WHERE c2."outingId" = o.id AND c2."userId" = ${opts.userId})`
    : Prisma.empty;
  const boatFilter = opts.boatId ? Prisma.sql`AND o."boatId" = ${opts.boatId}` : Prisma.empty;

  const rows = await prisma.$queryRaw<{ month: string; km: Prisma.Decimal; outings: bigint }[]>`
    SELECT to_char(o."departureAt" AT TIME ZONE 'Europe/Zurich', 'YYYY-MM') AS month,
           COALESCE(SUM(o."distanceKm"), 0) AS km,
           COUNT(*) AS outings
    FROM "Outing" o
    WHERE o."status" = 'COMPLETED' ${inRange(range)} ${userFilter} ${boatFilter}
    GROUP BY 1`;
  const rowers = await prisma.$queryRaw<{ month: string; n: bigint }[]>`
    SELECT to_char(o."departureAt" AT TIME ZONE 'Europe/Zurich', 'YYYY-MM') AS month,
           COUNT(DISTINCT c."userId") AS n
    FROM "Outing" o JOIN "OutingCrew" c ON c."outingId" = o.id
    WHERE o."status" = 'COMPLETED' ${inRange(range)} ${userFilter} ${boatFilter}
    GROUP BY 1`;

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const rowersByMonth = new Map(rowers.map((r) => [r.month, num(r.n)]));
  return monthsInRange(range).map<MonthlyPoint>((m) => ({
    month: m,
    km: Math.round(num(byMonth.get(m)?.km) * 10) / 10,
    outings: num(byMonth.get(m)?.outings),
    activeRowers: rowersByMonth.get(m) ?? 0,
  }));
}

export interface BoatStat {
  boatId: string;
  name: string;
  typeCode: string;
  outings: number;
  km: number;
  minutes: number;
  lastUsedAt: Date | null;
}

export async function getBoatStats(range?: DateRange | null): Promise<BoatStat[]> {
  const rows = await prisma.$queryRaw<
    {
      boatId: string;
      name: string;
      typeCode: string;
      outings: bigint;
      km: Prisma.Decimal;
      minutes: number;
      lastUsedAt: Date | null;
    }[]
  >`
    SELECT b.id AS "boatId", b."name", t."code" AS "typeCode",
           COUNT(o.id) AS outings,
           COALESCE(SUM(o."distanceKm"), 0) AS km,
           COALESCE(SUM(EXTRACT(EPOCH FROM (o."returnAt" - o."departureAt")) / 60), 0)::float8 AS minutes,
           MAX(o."departureAt") AS "lastUsedAt"
    FROM "Boat" b
    JOIN "BoatType" t ON t.id = b."boatTypeId"
    LEFT JOIN "Outing" o ON o."boatId" = b.id AND o."status" = 'COMPLETED' ${inRange(range)}
    GROUP BY b.id, b."name", t."code"
    ORDER BY km DESC, b."name"`;
  return rows.map((r) => ({
    ...r,
    outings: num(r.outings),
    km: num(r.km),
    minutes: Math.round(num(r.minutes)),
  }));
}

export interface MemberStat {
  userId: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  outings: number;
  km: number;
  kmRowed: number;
  kmCoxed: number;
  minutes: number;
  lastOutingAt: Date | null;
}

export async function getMemberStats(range?: DateRange | null, opts: { userId?: string } = {}): Promise<MemberStat[]> {
  const userFilter = opts.userId ? Prisma.sql`WHERE u.id = ${opts.userId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<
    {
      userId: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
      outings: bigint;
      km: Prisma.Decimal;
      kmRowed: Prisma.Decimal;
      kmCoxed: Prisma.Decimal;
      minutes: number;
      lastOutingAt: Date | null;
    }[]
  >`
    SELECT u.id AS "userId", u."firstName", u."lastName", u."isActive",
           COUNT(o.id) AS outings,
           COALESCE(SUM(o."distanceKm"), 0) AS km,
           COALESCE(SUM(o."distanceKm") FILTER (WHERE c."crewRole" = 'ROWER'), 0) AS "kmRowed",
           COALESCE(SUM(o."distanceKm") FILTER (WHERE c."crewRole" = 'COXSWAIN'), 0) AS "kmCoxed",
           COALESCE(SUM(EXTRACT(EPOCH FROM (o."returnAt" - o."departureAt")) / 60), 0)::float8 AS minutes,
           MAX(o."departureAt") AS "lastOutingAt"
    FROM "User" u
    LEFT JOIN "OutingCrew" c ON c."userId" = u.id
    LEFT JOIN "Outing" o ON o.id = c."outingId" AND o."status" = 'COMPLETED' ${inRange(range)}
    ${userFilter}
    GROUP BY u.id
    ORDER BY km DESC, outings DESC, u."lastName"`;
  return rows.map((r) => ({
    ...r,
    outings: num(r.outings),
    km: num(r.km),
    kmRowed: num(r.kmRowed),
    kmCoxed: num(r.kmCoxed),
    minutes: Math.round(num(r.minutes)),
  }));
}

export async function getMemberSummary(userId: string, range?: DateRange | null) {
  const [s] = await getMemberStats(range, { userId });
  return s ?? null;
}

/** Partenaires d'équipage les plus fréquents d'un membre. */
export async function getFrequentCrewmates(userId: string, take = 5) {
  const rows = await prisma.$queryRaw<{ userId: string; firstName: string; lastName: string; n: bigint }[]>`
    SELECT u.id AS "userId", u."firstName", u."lastName", COUNT(*) AS n
    FROM "OutingCrew" me
    JOIN "Outing" o ON o.id = me."outingId" AND o."status" = 'COMPLETED'
    JOIN "OutingCrew" c ON c."outingId" = o.id AND c."userId" <> me."userId"
    JOIN "User" u ON u.id = c."userId"
    WHERE me."userId" = ${userId}
    GROUP BY u.id ORDER BY n DESC, u."lastName" LIMIT ${take}`;
  return rows.map((r) => ({ ...r, n: num(r.n) }));
}

export interface DirectionStat {
  direction: "GENEVA" | "LAUSANNE" | null;
  outings: number;
  km: number;
}

/** Répartition des sorties terminées par direction (Genève / Lausanne). */
export async function getDirectionStats(range?: DateRange | null): Promise<DirectionStat[]> {
  const rows = await prisma.$queryRaw<{ direction: "GENEVA" | "LAUSANNE" | null; outings: bigint; km: Prisma.Decimal }[]>`
    SELECT o."direction" AS direction, COUNT(*) AS outings, COALESCE(SUM(o."distanceKm"), 0) AS km
    FROM "Outing" o
    WHERE o."status" = 'COMPLETED' ${inRange(range)}
    GROUP BY o."direction"`;
  return rows.map((r) => ({ direction: r.direction, outings: num(r.outings), km: num(r.km) }));
}
