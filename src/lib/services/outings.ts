/**
 * Service métier des sorties.
 *
 * Les deux modes d'enregistrement (LIVE et RETROSPECTIVE) écrivent dans la même
 * table `Outing` : registre, fiches bateaux, profils et statistiques sont donc
 * toujours alimentés de la même manière.
 *
 * Protection contre la concurrence, en trois niveaux :
 *  1. verrous transactionnels PostgreSQL (pg_advisory_xact_lock) par bateau et par membre,
 *     qui sérialisent les opérations concurrentes sur les mêmes ressources ;
 *  2. vérifications applicatives dans la transaction (messages clairs pour l'utilisateur) ;
 *  3. contraintes de la base (index unique partiel + contrainte d'exclusion GiST),
 *     garde-fou ultime même si une autre application écrivait dans la base.
 */
import { Prisma, type CrewRole, type Outing, type OutingCrew } from "@prisma/client";
import type { ZodTypeAny, output } from "zod";
import { prisma, type Tx } from "@/lib/prisma";
import { DomainError, mapDatabaseError } from "@/lib/errors";
import {
  canCancelOuting,
  canEditOuting,
  canFinishOuting,
  canOverrideOverlap,
  canUseInactiveMembers,
  isAdmin,
  type Actor,
} from "@/lib/permissions";
import {
  cancelOutingSchema,
  finishOutingSchema,
  retrospectiveOutingSchema,
  startOutingSchema,
  updateOutingSchema,
  type CrewMemberInput,
  type FinishOutingInput,
  type RetrospectiveOutingInput,
  type StartOutingInput,
  type UpdateOutingInput,
} from "@/lib/validation/outing";
import { formatDateTime, formatTime, fromLocalDateTime, resolveOutingTimes } from "@/lib/time";
import { writeAudit } from "./audit";

/** Tolérance d'horloge pour les heures saisies « dans le futur ». */
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
/** Un départ en temps réel ne peut pas être antidaté de plus de 12 h. */
const LIVE_MAX_BACKDATE_MS = 12 * 3600 * 1000;
/** Durée maximale d'une sortie saisie (hors correction administrative). */
const MAX_OUTING_DURATION_MS = 24 * 3600 * 1000;

type OutingWithCrew = Outing & { crew: OutingCrew[] };

function parseOrThrow<T extends ZodTypeAny>(schema: T, input: unknown): output<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new DomainError("VALIDATION", first?.message ?? "Données invalides", {
      fieldErrors: Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message])),
    });
  }
  return r.data;
}

function snapshot(o: OutingWithCrew) {
  return {
    boatId: o.boatId,
    departureAt: o.departureAt,
    returnAt: o.returnAt,
    distanceKm: o.distanceKm == null ? null : Number(o.distanceKm),
    status: o.status,
    notes: o.notes,
    overlapApproved: o.overlapApproved,
    crew: o.crew
      .map((c) => ({ userId: c.userId, crewRole: c.crewRole }))
      .sort((a, b) => a.userId.localeCompare(b.userId)),
  };
}

const accessInfo = (o: OutingWithCrew) => ({
  status: o.status,
  createdById: o.createdById,
  departureAt: o.departureAt,
  createdAt: o.createdAt,
  crewUserIds: o.crew.map((c) => c.userId),
});

/** Verrous transactionnels, toujours pris dans le même ordre pour éviter les interblocages. */
async function lockResources(tx: Tx, boatIds: string[], userIds: string[]) {
  const keys = [
    ...[...new Set(boatIds)].sort().map((id) => `boat:${id}`),
    ...[...new Set(userIds)].sort().map((id) => `user:${id}`),
  ];
  if (keys.length === 0) return;
  // Une seule requête : les verrous sont pris dans l'ordre du tableau (WITH ORDINALITY).
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(k))
    FROM unnest(${keys}::text[]) WITH ORDINALITY AS t(k, i)
    ORDER BY i`;
}

async function runInTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(fn, { timeout: 30000, maxWait: 15000 });
  } catch (e) {
    if (e instanceof DomainError) throw e;
    const mapped = mapDatabaseError(e);
    if (mapped) throw mapped;
    throw e;
  }
}

async function loadBoat(tx: Tx, boatId: string) {
  const boat = await tx.boat.findUnique({ where: { id: boatId }, include: { boatType: true } });
  if (!boat || boat.isArchived) throw new DomainError("NOT_FOUND", "Bateau introuvable.");
  return boat;
}

function assertCapacity(
  boat: { name: string; rowingCapacity: number; coxswainCapacity: number },
  crew: CrewMemberInput[],
) {
  const rowers = crew.filter((c) => c.crewRole === "ROWER").length;
  const coxes = crew.filter((c) => c.crewRole === "COXSWAIN").length;
  if (rowers > boat.rowingCapacity) {
    throw new DomainError(
      "CAPACITY",
      `${boat.name} accueille ${boat.rowingCapacity} rameur${boat.rowingCapacity > 1 ? "s" : ""} maximum (${rowers} sélectionnés).`,
    );
  }
  if (coxes > boat.coxswainCapacity) {
    throw new DomainError(
      "CAPACITY",
      boat.coxswainCapacity === 0 ? `${boat.name} n'a pas de place de barreur.` : `${boat.name} n'accueille qu'un barreur.`,
    );
  }
}

async function assertCrewMembers(tx: Tx, crew: CrewMemberInput[], allowInactiveIds: Set<string> | "all") {
  const users = await tx.user.findMany({
    where: { id: { in: crew.map((c) => c.userId) } },
    select: { id: true, firstName: true, lastName: true, isActive: true },
  });
  if (users.length !== crew.length) throw new DomainError("VALIDATION", "Un membre de l'équipage est introuvable.");
  for (const u of users) {
    if (!u.isActive && allowInactiveIds !== "all" && !allowInactiveIds.has(u.id)) {
      throw new DomainError("VALIDATION", `${u.firstName} ${u.lastName} n'est plus membre actif du club.`);
    }
  }
  return users;
}

/** Sorties non annulées du bateau qui chevauchent [from, to[ (to = null : sortie ouverte). */
async function findBoatConflicts(tx: Tx, boatId: string, from: Date, to: Date | null, excludeId?: string) {
  return tx.outing.findMany({
    where: {
      boatId,
      status: { not: "CANCELLED" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(to ? { departureAt: { lt: to } } : {}),
      OR: [{ returnAt: null }, { returnAt: { gt: from } }],
    },
    select: { id: true, departureAt: true, returnAt: true, status: true },
    orderBy: { departureAt: "asc" },
  });
}

/** Membres de l'équipage déjà engagés dans une autre sortie sur [from, to[. */
async function findCrewConflicts(tx: Tx, userIds: string[], from: Date, to: Date | null, excludeId?: string) {
  return tx.outingCrew.findMany({
    where: {
      userId: { in: userIds },
      outing: {
        status: { not: "CANCELLED" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(to ? { departureAt: { lt: to } } : {}),
        OR: [{ returnAt: null }, { returnAt: { gt: from } }],
      },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
      outing: { select: { id: true, departureAt: true, boat: { select: { name: true } } } },
    },
  });
}

function describeConflict(c: { departureAt: Date; returnAt: Date | null; status: string }) {
  return c.returnAt
    ? `le ${formatDateTime(c.departureAt)} – ${formatTime(c.returnAt)}`
    : `en cours depuis ${formatDateTime(c.departureAt)}`;
}

/**
 * Vérifie l'absence de chevauchement (bateau + équipage).
 * Retourne `true` si un chevauchement a été explicitement autorisé par un administrateur.
 */
async function checkOverlaps(
  tx: Tx,
  actor: Actor,
  args: {
    boatId: string;
    boatName: string;
    userIds: string[];
    from: Date;
    to: Date | null;
    excludeId?: string;
    allowOverlap: boolean;
  },
): Promise<{ overridden: boolean; conflicts: unknown[] }> {
  const boatConflicts = await findBoatConflicts(tx, args.boatId, args.from, args.to, args.excludeId);
  const crewConflicts = await findCrewConflicts(tx, args.userIds, args.from, args.to, args.excludeId);
  if (boatConflicts.length === 0 && crewConflicts.length === 0) return { overridden: false, conflicts: [] };

  const conflicts = [
    ...boatConflicts.map((c) => ({ type: "boat", outingId: c.id, departureAt: c.departureAt, returnAt: c.returnAt })),
    ...crewConflicts.map((c) => ({ type: "crew", userId: c.userId, outingId: c.outing.id })),
  ];

  if (args.allowOverlap && canOverrideOverlap(actor)) return { overridden: true, conflicts };

  if (boatConflicts.length > 0) {
    throw new DomainError(
      "OVERLAP",
      `${args.boatName} est déjà enregistré sur une sortie ${describeConflict(boatConflicts[0])}. ` +
        `Vérifiez les heures saisies.`,
      { conflicts, canOverride: canOverrideOverlap(actor) },
    );
  }
  const c = crewConflicts[0];
  throw new DomainError(
    "CREW_BUSY",
    `${c.user.firstName} ${c.user.lastName} est déjà enregistré(e) sur une sortie en ${c.outing.boat.name} ` +
      `(départ ${formatDateTime(c.outing.departureAt)}) qui chevauche cette période.`,
    { conflicts, canOverride: canOverrideOverlap(actor) },
  );
}

async function loadOuting(tx: Tx, id: string): Promise<OutingWithCrew> {
  const o = await tx.outing.findUnique({ where: { id }, include: { crew: true } });
  if (!o) throw new DomainError("NOT_FOUND", "Sortie introuvable.");
  return o;
}

// ---------------------------------------------------------------------------
// MODE A — Départ en temps réel
// ---------------------------------------------------------------------------
export async function startOuting(actor: Actor, input: StartOutingInput, now: Date = new Date()) {
  const data = parseOrThrow(startOutingSchema, input);
  const departureAt = fromLocalDateTime(data.departureDate, data.departureTime);

  if (departureAt.getTime() > now.getTime() + CLOCK_TOLERANCE_MS) {
    throw new DomainError("VALIDATION", "L'heure de départ ne peut pas être dans le futur.");
  }
  if (now.getTime() - departureAt.getTime() > LIVE_MAX_BACKDATE_MS) {
    throw new DomainError(
      "VALIDATION",
      "Ce départ date de plus de 12 heures. Pour une sortie déjà terminée, utilisez « Ajouter une sortie passée ».",
    );
  }

  const userIds = data.crew.map((c) => c.userId);
  return runInTransaction(async (tx) => {
    await lockResources(tx, [data.boatId], userIds);
    const boat = await loadBoat(tx, data.boatId);

    if (boat.maintenanceStatus !== "AVAILABLE") {
      throw new DomainError(
        "BOAT_UNAVAILABLE",
        `${boat.name} est ${boat.maintenanceStatus === "MAINTENANCE" ? "en maintenance" : "indisponible"} et ne peut pas sortir.`,
      );
    }
    const active = await tx.outing.findFirst({
      where: { boatId: boat.id, status: "IN_PROGRESS" },
      include: { crew: { include: { user: { select: { firstName: true } } } } },
    });
    if (active) {
      throw new DomainError(
        "BOAT_BUSY",
        `${boat.name} est déjà sur l'eau depuis ${formatTime(active.departureAt)} (${active.crew
          .map((c) => c.user.firstName)
          .join(", ")}).`,
      );
    }
    assertCapacity(boat, data.crew);
    await assertCrewMembers(tx, data.crew, new Set());

    const busy = await tx.outingCrew.findFirst({
      where: { userId: { in: userIds }, outing: { status: "IN_PROGRESS" } },
      include: { user: true, outing: { include: { boat: true } } },
    });
    if (busy) {
      throw new DomainError(
        "CREW_BUSY",
        `${busy.user.firstName} ${busy.user.lastName} est déjà en sortie sur ${busy.outing.boat.name}.`,
      );
    }
    // Pas de chevauchement avec une sortie déjà enregistrée (ex. saisie rétrospective récente)
    await checkOverlaps(tx, actor, {
      boatId: boat.id,
      boatName: boat.name,
      userIds,
      from: departureAt,
      to: null,
      allowOverlap: false,
    });

    const outing = await tx.outing.create({
      data: {
        boatId: boat.id,
        createdById: actor.id,
        departureAt,
        status: "IN_PROGRESS",
        entryMode: "LIVE",
        notes: data.notes ?? null,
        crew: { create: data.crew.map((c) => ({ userId: c.userId, crewRole: c.crewRole as CrewRole })) },
      },
      include: { crew: true },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      entityType: "Outing",
      entityId: outing.id,
      action: "START",
      newValues: snapshot(outing),
    });
    return outing;
  });
}

// ---------------------------------------------------------------------------
// MODE A — Retour
// ---------------------------------------------------------------------------
export async function finishOuting(actor: Actor, outingId: string, input: FinishOutingInput, now: Date = new Date()) {
  const data = parseOrThrow(finishOutingSchema, input);
  const returnAt = fromLocalDateTime(data.returnDate, data.returnTime);

  return runInTransaction(async (tx) => {
    const existing = await loadOuting(tx, outingId);
    await lockResources(tx, [existing.boatId], []);
    const outing = await loadOuting(tx, outingId); // relecture après verrou

    if (outing.status === "COMPLETED") throw new DomainError("ALREADY_FINISHED", "Cette sortie est déjà terminée.");
    if (outing.status === "CANCELLED") throw new DomainError("CONFLICT", "Cette sortie a été annulée.");
    if (!canFinishOuting(actor, accessInfo(outing))) {
      throw new DomainError("FORBIDDEN", "Seuls les membres de l'équipage ou un administrateur peuvent terminer cette sortie.");
    }
    if (returnAt.getTime() <= outing.departureAt.getTime()) {
      throw new DomainError(
        "VALIDATION",
        `L'heure de retour doit être postérieure au départ (${formatDateTime(outing.departureAt)}).`,
      );
    }
    if (returnAt.getTime() > now.getTime() + CLOCK_TOLERANCE_MS) {
      throw new DomainError("VALIDATION", "L'heure de retour ne peut pas être dans le futur.");
    }
    if (!isAdmin(actor) && returnAt.getTime() - outing.departureAt.getTime() > MAX_OUTING_DURATION_MS) {
      throw new DomainError(
        "VALIDATION",
        "Une sortie ne peut pas durer plus de 24 heures. Contactez un administrateur pour corriger cette sortie.",
      );
    }

    // Mise à jour conditionnelle : seule la première demande de retour aboutit.
    const res = await tx.outing.updateMany({
      where: { id: outingId, status: "IN_PROGRESS" },
      data: {
        status: "COMPLETED",
        returnAt,
        distanceKm: new Prisma.Decimal(data.distanceKm),
        notes: data.notes ?? outing.notes,
        updatedById: actor.id,
      },
    });
    if (res.count !== 1) throw new DomainError("ALREADY_FINISHED", "Cette sortie est déjà terminée.");

    const updated = await loadOuting(tx, outingId);
    await writeAudit(tx, {
      actorId: actor.id,
      entityType: "Outing",
      entityId: outingId,
      action: "FINISH",
      previousValues: snapshot(outing),
      newValues: snapshot(updated),
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// MODE B — Sortie passée
// ---------------------------------------------------------------------------
export async function createRetrospectiveOuting(
  actor: Actor,
  input: RetrospectiveOutingInput,
  now: Date = new Date(),
) {
  const data = parseOrThrow(retrospectiveOutingSchema, input);
  const { departureAt, returnAt } = resolveOutingTimes(data.date, data.departureTime, data.returnTime);

  if (returnAt.getTime() > now.getTime() + CLOCK_TOLERANCE_MS) {
    throw new DomainError(
      "VALIDATION",
      "Cette sortie se termine dans le futur. Pour une sortie qui commence maintenant, utilisez « Démarrer une sortie ».",
    );
  }
  if (returnAt.getTime() - departureAt.getTime() > MAX_OUTING_DURATION_MS) {
    throw new DomainError("VALIDATION", "Une sortie ne peut pas durer plus de 24 heures.");
  }
  if (data.date < "1990-01-01") throw new DomainError("VALIDATION", "Date trop ancienne.");

  const userIds = data.crew.map((c) => c.userId);
  return runInTransaction(async (tx) => {
    await lockResources(tx, [data.boatId], userIds);
    const boat = await loadBoat(tx, data.boatId);
    assertCapacity(boat, data.crew);
    await assertCrewMembers(tx, data.crew, canUseInactiveMembers(actor) ? "all" : new Set());

    const { overridden, conflicts } = await checkOverlaps(tx, actor, {
      boatId: boat.id,
      boatName: boat.name,
      userIds,
      from: departureAt,
      to: returnAt,
      allowOverlap: data.allowOverlap,
    });

    const outing = await tx.outing.create({
      data: {
        boatId: boat.id,
        createdById: actor.id,
        departureAt,
        returnAt,
        distanceKm: new Prisma.Decimal(data.distanceKm),
        status: "COMPLETED",
        entryMode: "RETROSPECTIVE",
        notes: data.notes ?? null,
        overlapApproved: overridden,
        crew: { create: data.crew.map((c) => ({ userId: c.userId, crewRole: c.crewRole as CrewRole })) },
      },
      include: { crew: true },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      entityType: "Outing",
      entityId: outing.id,
      action: "CREATE",
      newValues: snapshot(outing),
    });
    if (overridden) {
      await writeAudit(tx, {
        actorId: actor.id,
        entityType: "Outing",
        entityId: outing.id,
        action: "OVERLAP_OVERRIDE",
        newValues: { conflicts },
      });
    }
    return outing;
  });
}

// ---------------------------------------------------------------------------
// Modification / correction
// ---------------------------------------------------------------------------
export async function updateOuting(actor: Actor, outingId: string, input: UpdateOutingInput, now: Date = new Date()) {
  const data = parseOrThrow(updateOutingSchema, input);

  return runInTransaction(async (tx) => {
    const before0 = await loadOuting(tx, outingId);
    const userIds = data.crew.map((c) => c.userId);
    await lockResources(tx, [before0.boatId, data.boatId], [...userIds, ...before0.crew.map((c) => c.userId)]);
    const before = await loadOuting(tx, outingId);

    if (!canEditOuting(actor, accessInfo(before), now)) {
      throw new DomainError(
        "FORBIDDEN",
        before.status === "CANCELLED"
          ? "Une sortie annulée ne peut plus être modifiée."
          : "Vous ne pouvez modifier que vos propres sorties des 7 derniers jours. Contactez un administrateur.",
      );
    }

    let departureAt: Date;
    let returnAt: Date | null = null;
    if (before.status === "COMPLETED") {
      if (!data.returnTime) throw new DomainError("VALIDATION", "Indiquez l'heure de retour.");
      if (data.distanceKm === undefined) throw new DomainError("VALIDATION", "Indiquez la distance parcourue.");
      ({ departureAt, returnAt } = resolveOutingTimes(data.date, data.departureTime, data.returnTime));
      if (returnAt.getTime() > now.getTime() + CLOCK_TOLERANCE_MS)
        throw new DomainError("VALIDATION", "L'heure de retour ne peut pas être dans le futur.");
      if (!isAdmin(actor) && returnAt.getTime() - departureAt.getTime() > MAX_OUTING_DURATION_MS)
        throw new DomainError("VALIDATION", "Une sortie ne peut pas durer plus de 24 heures.");
    } else {
      departureAt = fromLocalDateTime(data.date, data.departureTime);
      if (departureAt.getTime() > now.getTime() + CLOCK_TOLERANCE_MS)
        throw new DomainError("VALIDATION", "L'heure de départ ne peut pas être dans le futur.");
    }

    const boat = await loadBoat(tx, data.boatId);
    if (before.status === "IN_PROGRESS" && boat.id !== before.boatId && boat.maintenanceStatus !== "AVAILABLE") {
      throw new DomainError("BOAT_UNAVAILABLE", `${boat.name} n'est pas disponible.`);
    }
    assertCapacity(boat, data.crew);
    const previousCrew = new Set(before.crew.map((c) => c.userId));
    await assertCrewMembers(tx, data.crew, canUseInactiveMembers(actor) ? "all" : previousCrew);

    const { overridden, conflicts } = await checkOverlaps(tx, actor, {
      boatId: boat.id,
      boatName: boat.name,
      userIds,
      from: departureAt,
      to: returnAt,
      excludeId: before.id,
      allowOverlap: data.allowOverlap,
    });

    await tx.outingCrew.deleteMany({ where: { outingId } });
    await tx.outing.update({
      where: { id: outingId },
      data: {
        boatId: boat.id,
        departureAt,
        ...(before.status === "COMPLETED"
          ? { returnAt, distanceKm: new Prisma.Decimal(data.distanceKm as number) }
          : {}),
        notes: data.notes ?? null,
        overlapApproved: overridden || (before.overlapApproved && isAdmin(actor) && data.allowOverlap),
        updatedById: actor.id,
        crew: { create: data.crew.map((c) => ({ userId: c.userId, crewRole: c.crewRole as CrewRole })) },
      },
    });
    const after = await loadOuting(tx, outingId);
    await writeAudit(tx, {
      actorId: actor.id,
      entityType: "Outing",
      entityId: outingId,
      action: "UPDATE",
      previousValues: snapshot(before),
      newValues: { ...snapshot(after), ...(data.reason ? { reason: data.reason } : {}) },
    });
    if (overridden) {
      await writeAudit(tx, {
        actorId: actor.id,
        entityType: "Outing",
        entityId: outingId,
        action: "OVERLAP_OVERRIDE",
        newValues: { conflicts },
      });
    }
    return after;
  });
}

// ---------------------------------------------------------------------------
// Annulation (suppression logique : l'historique est conservé)
// ---------------------------------------------------------------------------
export async function cancelOuting(actor: Actor, outingId: string, input: { reason: string }, now: Date = new Date()) {
  const { reason } = parseOrThrow(cancelOutingSchema, input);
  return runInTransaction(async (tx) => {
    const before0 = await loadOuting(tx, outingId);
    await lockResources(tx, [before0.boatId], []);
    const before = await loadOuting(tx, outingId);
    if (before.status === "CANCELLED") throw new DomainError("CONFLICT", "Cette sortie est déjà annulée.");
    if (!canCancelOuting(actor, accessInfo(before), now)) {
      throw new DomainError("FORBIDDEN", "Seul un administrateur peut annuler cette sortie.");
    }
    const after = await tx.outing.update({
      where: { id: outingId },
      data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason, updatedById: actor.id },
      include: { crew: true },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      entityType: "Outing",
      entityId: outingId,
      action: "CANCEL",
      previousValues: snapshot(before),
      newValues: { ...snapshot(after), reason },
    });
    return after;
  });
}
