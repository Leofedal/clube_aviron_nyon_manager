import type { MaintenanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError, mapDatabaseError } from "@/lib/errors";
import { canManageBoats, type Actor } from "@/lib/permissions";
import { boatSchema, boatTypeSchema, type BoatInput, type BoatTypeInput } from "@/lib/validation/admin";
import { writeAudit } from "./audit";

export const MAINTENANCE_LABELS: Record<MaintenanceStatus, string> = {
  AVAILABLE: "En service",
  MAINTENANCE: "En maintenance",
  UNAVAILABLE: "Indisponible",
};

/** Disponibilité affichée — « En sortie » est dérivé des sorties actives, jamais stocké. */
export type BoatAvailability = "AVAILABLE" | "ON_WATER" | "MAINTENANCE" | "UNAVAILABLE";

export const AVAILABILITY_LABELS: Record<BoatAvailability, string> = {
  AVAILABLE: "Disponible",
  ON_WATER: "Sur l'eau",
  MAINTENANCE: "En maintenance",
  UNAVAILABLE: "Indisponible",
};

export function deriveAvailability(maintenance: MaintenanceStatus, hasActiveOuting: boolean): BoatAvailability {
  if (hasActiveOuting) return "ON_WATER";
  return maintenance;
}

/** Bateaux avec leur disponibilité actuelle (utilisé pour le choix du bateau au départ). */
export async function listBoatsWithAvailability(opts: { includeArchived?: boolean } = {}) {
  const boats = await prisma.boat.findMany({
    where: opts.includeArchived ? {} : { isArchived: false },
    include: {
      boatType: true,
      outings: {
        where: { status: "IN_PROGRESS" },
        include: { crew: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      },
    },
    orderBy: [{ boatType: { sortOrder: "asc" } }, { name: "asc" }],
  });
  return boats.map(({ outings, ...b }) => {
    const active = outings[0] ?? null;
    return { ...b, activeOuting: active, availability: deriveAvailability(b.maintenanceStatus, !!active) };
  });
}

export type BoatWithAvailability = Awaited<ReturnType<typeof listBoatsWithAvailability>>[number];

/** Toutes les étiquettes déjà utilisées (suggestions dans le formulaire). */
export async function listBoatTagSuggestions(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT DISTINCT unnest("tags") AS tag FROM "Boat" ORDER BY 1`;
  return rows.map((r) => r.tag);
}

export function listBoatTypes() {
  return prisma.boatType.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
}

function assertAdmin(actor: Actor) {
  if (!canManageBoats(actor)) throw new DomainError("FORBIDDEN", "Action réservée aux administrateurs.");
}

function parse<T>(r: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }): T {
  if (!r.success) throw new DomainError("VALIDATION", r.error.issues[0]?.message ?? "Données invalides");
  return r.data;
}

export async function createBoat(actor: Actor, input: BoatInput) {
  assertAdmin(actor);
  const data = parse(boatSchema.safeParse(input));
  try {
    return await prisma.$transaction(async (tx) => {
      const boat = await tx.boat.create({ data });
      await writeAudit(tx, { actorId: actor.id, entityType: "Boat", entityId: boat.id, action: "CREATE", newValues: boat });
      return boat;
    });
  } catch (e) {
    throw uniqueNameError(e) ?? mapDatabaseError(e) ?? e;
  }
}

export async function updateBoat(actor: Actor, boatId: string, input: BoatInput) {
  assertAdmin(actor);
  const data = parse(boatSchema.safeParse(input));
  try {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.boat.findUnique({ where: { id: boatId } });
      if (!before) throw new DomainError("NOT_FOUND", "Bateau introuvable.");
      const boat = await tx.boat.update({ where: { id: boatId }, data });
      await writeAudit(tx, {
        actorId: actor.id,
        entityType: "Boat",
        entityId: boat.id,
        action: "UPDATE",
        previousValues: before,
        newValues: boat,
      });
      return boat;
    });
  } catch (e) {
    throw uniqueNameError(e) ?? mapDatabaseError(e) ?? e;
  }
}

/** Mise en maintenance / remise en service rapide. */
export async function setBoatMaintenance(actor: Actor, boatId: string, status: MaintenanceStatus, note?: string) {
  assertAdmin(actor);
  return prisma.$transaction(async (tx) => {
    const before = await tx.boat.findUnique({ where: { id: boatId } });
    if (!before) throw new DomainError("NOT_FOUND", "Bateau introuvable.");
    const boat = await tx.boat.update({
      where: { id: boatId },
      data: { maintenanceStatus: status, ...(note !== undefined ? { notes: note || null } : {}) },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      entityType: "Boat",
      entityId: boatId,
      action: "UPDATE",
      previousValues: { maintenanceStatus: before.maintenanceStatus, notes: before.notes },
      newValues: { maintenanceStatus: boat.maintenanceStatus, notes: boat.notes },
    });
    return boat;
  });
}

export async function createBoatType(actor: Actor, input: BoatTypeInput) {
  assertAdmin(actor);
  const data = parse(boatTypeSchema.safeParse(input));
  const exists = await prisma.boatType.findUnique({ where: { code: data.code } });
  if (exists) throw new DomainError("CONFLICT", `Le type « ${data.code} » existe déjà.`);
  return prisma.$transaction(async (tx) => {
    const t = await tx.boatType.create({ data });
    await writeAudit(tx, { actorId: actor.id, entityType: "BoatType", entityId: t.id, action: "CREATE", newValues: t });
    return t;
  });
}

function uniqueNameError(e: unknown) {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err?.code === "P2002") return new DomainError("CONFLICT", "Un bateau porte déjà ce nom.");
  return null;
}
