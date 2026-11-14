import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  cancelOuting,
  createRetrospectiveOuting,
  finishOuting,
  startOuting,
  updateOuting,
} from "@/lib/services/outings";
import { DomainError } from "@/lib/errors";
import { actorOf, makeBoat, makeUser, resetDb, rowers } from "../helpers";

// « Maintenant » fixe : samedi 14/11/2026 11:00 à Zurich (10:00 UTC)
const NOW = new Date("2026-11-14T10:00:00Z");
const TODAY = "2026-11-14";

async function expectDomainError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof DomainError && e.code === code);
}

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("Mode A — départ en temps réel", () => {
  it("démarre une sortie : statut « En cours », mode LIVE, équipage enregistré, audit", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const boat = await makeBoat({ rowers: 2 });
    const o = await startOuting(
      actorOf(a),
      { boatId: boat.id, crew: rowers(a.id, b.id), departureDate: TODAY, departureTime: "10:55" },
      NOW,
    );
    expect(o.status).toBe("IN_PROGRESS");
    expect(o.entryMode).toBe("LIVE");
    expect(o.returnAt).toBeNull();
    expect(o.crew).toHaveLength(2);
    expect(o.departureAt.toISOString()).toBe("2026-11-14T09:55:00.000Z");
    expect(await prisma.auditLog.count({ where: { entityId: o.id, action: "START" } })).toBe(1);
  });

  it("refuse un bateau déjà sur l'eau", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const boat = await makeBoat({ rowers: 1 });
    await startOuting(actorOf(a), { boatId: boat.id, crew: rowers(a.id), departureDate: TODAY, departureTime: "10:00" }, NOW);
    await expectDomainError(
      startOuting(actorOf(b), { boatId: boat.id, crew: rowers(b.id), departureDate: TODAY, departureTime: "10:30" }, NOW),
      "BOAT_BUSY",
    );
  });

  it("une étiquette d'avertissement ne bloque pas le départ", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    await prisma.boat.update({ where: { id: boat.id }, data: { tags: ["Compétiteurs ou chevronnés seulement"] } });
    const o = await startOuting(actorOf(a), { boatId: boat.id, crew: rowers(a.id), departureDate: TODAY, departureTime: "10:00" }, NOW);
    expect(o.status).toBe("IN_PROGRESS");
  });

  it("refuse un bateau en maintenance", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1, maintenance: "MAINTENANCE" });
    await expectDomainError(
      startOuting(actorOf(a), { boatId: boat.id, crew: rowers(a.id), departureDate: TODAY, departureTime: "10:00" }, NOW),
      "BOAT_UNAVAILABLE",
    );
  });

  it("vérifie la capacité du bateau (rameurs et barreur)", async () => {
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    const skiff = await makeBoat({ rowers: 1 });
    await expectDomainError(
      startOuting(actorOf(a), { boatId: skiff.id, crew: rowers(a.id, b.id), departureDate: TODAY, departureTime: "10:00" }, NOW),
      "CAPACITY",
    );
    const double = await makeBoat({ rowers: 2, cox: 0 });
    await expectDomainError(
      startOuting(
        actorOf(a),
        {
          boatId: double.id,
          crew: [...rowers(a.id, b.id), { userId: c.id, crewRole: "COXSWAIN" }],
          departureDate: TODAY,
          departureTime: "10:00",
        },
        NOW,
      ),
      "CAPACITY",
    );
  });

  it("refuse un membre déjà en sortie sur un autre bateau", async () => {
    const a = await makeUser();
    const [b1, b2] = [await makeBoat({ rowers: 1 }), await makeBoat({ rowers: 1 })];
    await startOuting(actorOf(a), { boatId: b1.id, crew: rowers(a.id), departureDate: TODAY, departureTime: "10:00" }, NOW);
    await expectDomainError(
      startOuting(actorOf(a), { boatId: b2.id, crew: rowers(a.id), departureDate: TODAY, departureTime: "10:05" }, NOW),
      "CREW_BUSY",
    );
  });

  it("concurrence : deux départs simultanés sur le même bateau → un seul aboutit", async () => {
    const users = await Promise.all(Array.from({ length: 6 }, () => makeUser()));
    const boat = await makeBoat({ rowers: 1 });
    const results = await Promise.allSettled(
      users.map((u) =>
        startOuting(actorOf(u), { boatId: boat.id, crew: rowers(u.id), departureDate: TODAY, departureTime: "10:59" }, NOW),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.outing.count({ where: { boatId: boat.id, status: "IN_PROGRESS" } })).toBe(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(DomainError);
    }
  });

  it("la base refuse elle-même deux sorties actives sur un bateau (sans passer par le service)", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    const data = { boatId: boat.id, createdById: a.id, departureAt: new Date("2026-11-14T08:00:00Z"), entryMode: "LIVE" as const };
    await prisma.outing.create({ data });
    await expect(prisma.outing.create({ data: { ...data, departureAt: new Date("2026-11-14T09:00:00Z") } })).rejects.toThrow();
  });
});

describe("Mode A — retour", () => {
  async function started() {
    const [a, b] = [await makeUser(), await makeUser()];
    const boat = await makeBoat({ rowers: 2 });
    const o = await startOuting(
      actorOf(a),
      { boatId: boat.id, crew: rowers(a.id, b.id), departureDate: TODAY, departureTime: "08:30" },
      NOW,
    );
    return { a, b, boat, o };
  }

  it("termine la sortie, calcule la durée, libère le bateau", async () => {
    const { a, boat, o } = await started();
    const done = await finishOuting(actorOf(a), o.id, { returnDate: TODAY, returnTime: "10:00", distanceKm: "15" }, NOW);
    expect(done.status).toBe("COMPLETED");
    expect(Number(done.distanceKm)).toBe(15);
    expect((done.returnAt!.getTime() - done.departureAt.getTime()) / 60000).toBe(90);
    expect(await prisma.outing.count({ where: { boatId: boat.id, status: "IN_PROGRESS" } })).toBe(0);
    // le bateau peut repartir immédiatement
    const again = await startOuting(actorOf(a), { boatId: boat.id, crew: rowers(a.id), departureDate: TODAY, departureTime: "10:30" }, NOW);
    expect(again.status).toBe("IN_PROGRESS");
  });

  it("impossible de terminer deux fois (même en simultané)", async () => {
    const { a, b, o } = await started();
    const results = await Promise.allSettled([
      finishOuting(actorOf(a), o.id, { returnDate: TODAY, returnTime: "10:00", distanceKm: "15" }, NOW),
      finishOuting(actorOf(b), o.id, { returnDate: TODAY, returnTime: "10:05", distanceKm: "16" }, NOW),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expectDomainError(
      finishOuting(actorOf(a), o.id, { returnDate: TODAY, returnTime: "10:10", distanceKm: "15" }, NOW),
      "ALREADY_FINISHED",
    );
  });

  it("refuse un retour antérieur au départ", async () => {
    const { a, o } = await started();
    await expectDomainError(
      finishOuting(actorOf(a), o.id, { returnDate: TODAY, returnTime: "08:00", distanceKm: "5" }, NOW),
      "VALIDATION",
    );
  });

  it("refuse un retour sans kilomètres", async () => {
    const { a, o } = await started();
    await expectDomainError(
      finishOuting(actorOf(a), o.id, { returnDate: TODAY, returnTime: "10:00", distanceKm: "" }, NOW),
      "VALIDATION",
    );
  });

  it("un membre extérieur à l'équipage ne peut pas terminer la sortie ; un admin oui", async () => {
    const { o } = await started();
    const stranger = await makeUser();
    await expectDomainError(
      finishOuting(actorOf(stranger), o.id, { returnDate: TODAY, returnTime: "10:00", distanceKm: "5" }, NOW),
      "FORBIDDEN",
    );
    const admin = await makeUser({ role: "ADMIN" });
    const done = await finishOuting(actorOf(admin), o.id, { returnDate: TODAY, returnTime: "10:00", distanceKm: "5" }, NOW);
    expect(done.updatedById).toBe(admin.id);
  });
});

describe("Mode B — sortie passée", () => {
  it("crée une sortie terminée en mode RETROSPECTIVE", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const boat = await makeBoat({ rowers: 2 });
    const o = await createRetrospectiveOuting(
      actorOf(a),
      { date: "2026-11-10", boatId: boat.id, crew: rowers(a.id, b.id), departureTime: "08:30", returnTime: "10:00", distanceKm: "14.5" },
      NOW,
    );
    expect(o.status).toBe("COMPLETED");
    expect(o.entryMode).toBe("RETROSPECTIVE");
    expect(o.createdById).toBe(a.id);
    expect(Number(o.distanceKm)).toBe(14.5);
  });

  it("accepte une sortie traversant minuit", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    const o = await createRetrospectiveOuting(
      actorOf(a),
      { date: "2026-11-12", boatId: boat.id, crew: rowers(a.id), departureTime: "23:15", returnTime: "00:45", distanceKm: "10" },
      NOW,
    );
    expect(o.departureAt.toISOString()).toBe("2026-11-12T22:15:00.000Z");
    expect(o.returnAt!.toISOString()).toBe("2026-11-12T23:45:00.000Z");
  });

  it("refuse une sortie dans le futur", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    await expectDomainError(
      createRetrospectiveOuting(
        actorOf(a),
        { date: TODAY, boatId: boat.id, crew: rowers(a.id), departureTime: "12:00", returnTime: "13:00", distanceKm: "10" },
        NOW,
      ),
      "VALIDATION",
    );
  });

  it("détecte les chevauchements sur le même bateau", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const boat = await makeBoat({ rowers: 1 });
    await createRetrospectiveOuting(
      actorOf(a),
      { date: "2026-11-10", boatId: boat.id, crew: rowers(a.id), departureTime: "08:00", returnTime: "10:00", distanceKm: "12" },
      NOW,
    );
    await expectDomainError(
      createRetrospectiveOuting(
        actorOf(b),
        { date: "2026-11-10", boatId: boat.id, crew: rowers(b.id), departureTime: "09:30", returnTime: "11:00", distanceKm: "10" },
        NOW,
      ),
      "OVERLAP",
    );
    // Sorties bout à bout : autorisé
    const next = await createRetrospectiveOuting(
      actorOf(b),
      { date: "2026-11-10", boatId: boat.id, crew: rowers(b.id), departureTime: "10:00", returnTime: "11:00", distanceKm: "10" },
      NOW,
    );
    expect(next.status).toBe("COMPLETED");
  });

  it("détecte un chevauchement avec une sortie en cours", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const boat = await makeBoat({ rowers: 1 });
    await startOuting(actorOf(a), { boatId: boat.id, crew: rowers(a.id), departureDate: TODAY, departureTime: "09:00" }, NOW);
    await expectDomainError(
      createRetrospectiveOuting(
        actorOf(b),
        { date: TODAY, boatId: boat.id, crew: rowers(b.id), departureTime: "09:30", returnTime: "10:30", distanceKm: "8" },
        NOW,
      ),
      "OVERLAP",
    );
  });

  it("détecte un membre déjà en sortie sur un autre bateau à la même heure", async () => {
    const a = await makeUser();
    const [b1, b2] = [await makeBoat({ rowers: 1 }), await makeBoat({ rowers: 1 })];
    await createRetrospectiveOuting(
      actorOf(a),
      { date: "2026-11-10", boatId: b1.id, crew: rowers(a.id), departureTime: "08:00", returnTime: "10:00", distanceKm: "12" },
      NOW,
    );
    await expectDomainError(
      createRetrospectiveOuting(
        actorOf(a),
        { date: "2026-11-10", boatId: b2.id, crew: rowers(a.id), departureTime: "09:00", returnTime: "10:30", distanceKm: "8" },
        NOW,
      ),
      "CREW_BUSY",
    );
  });

  it("un membre ne peut pas forcer un chevauchement ; un admin oui, avec trace dans le journal", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const admin = await makeUser({ role: "ADMIN" });
    const boat = await makeBoat({ rowers: 1 });
    const input = { date: "2026-11-10", boatId: boat.id, departureTime: "08:00", returnTime: "10:00", distanceKm: "12" };
    await createRetrospectiveOuting(actorOf(a), { ...input, crew: rowers(a.id) }, NOW);
    await expectDomainError(
      createRetrospectiveOuting(actorOf(b), { ...input, crew: rowers(b.id), allowOverlap: true }, NOW),
      "OVERLAP",
    );
    const forced = await createRetrospectiveOuting(actorOf(admin), { ...input, crew: rowers(b.id), allowOverlap: true }, NOW);
    expect(forced.overlapApproved).toBe(true);
    expect(await prisma.auditLog.count({ where: { entityId: forced.id, action: "OVERLAP_OVERRIDE" } })).toBe(1);
  });

  it("concurrence : deux saisies rétrospectives qui se chevauchent en simultané → une seule aboutit", async () => {
    const users = await Promise.all(Array.from({ length: 4 }, () => makeUser()));
    const boat = await makeBoat({ rowers: 1 });
    const results = await Promise.allSettled(
      users.map((u, i) =>
        createRetrospectiveOuting(
          actorOf(u),
          { date: "2026-11-10", boatId: boat.id, crew: rowers(u.id), departureTime: `08:${10 + i}`, returnTime: "09:30", distanceKm: "8" },
          NOW,
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("seul un admin peut inclure un membre désactivé (saisie d'archives)", async () => {
    const a = await makeUser();
    const admin = await makeUser({ role: "ADMIN" });
    const gone = await makeUser({ isActive: false });
    const boat = await makeBoat({ rowers: 2 });
    const input = { date: "2025-06-10", boatId: boat.id, departureTime: "08:00", returnTime: "10:00", distanceKm: "12", crew: rowers(a.id, gone.id) };
    await expectDomainError(createRetrospectiveOuting(actorOf(a), input, NOW), "VALIDATION");
    const o = await createRetrospectiveOuting(actorOf(admin), input, NOW);
    expect(o.crew).toHaveLength(2);
  });
});

describe("modification et annulation", () => {
  it("un membre corrige sa sortie récente ; un autre membre ne peut pas", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const boat = await makeBoat({ rowers: 2 });
    const o = await createRetrospectiveOuting(
      actorOf(a),
      { date: "2026-11-12", boatId: boat.id, crew: rowers(a.id), departureTime: "08:00", returnTime: "09:00", distanceKm: "8" },
      NOW,
    );
    const updated = await updateOuting(
      actorOf(a),
      o.id,
      { date: "2026-11-12", boatId: boat.id, crew: rowers(a.id, b.id), departureTime: "08:00", returnTime: "09:30", distanceKm: "10" },
      NOW,
    );
    expect(updated.crew).toHaveLength(2);
    expect(Number(updated.distanceKm)).toBe(10);
    const outsider = await makeUser();
    await expectDomainError(
      updateOuting(
        actorOf(outsider),
        o.id,
        { date: "2026-11-12", boatId: boat.id, crew: rowers(a.id), departureTime: "08:00", returnTime: "09:30", distanceKm: "1" },
        NOW,
      ),
      "FORBIDDEN",
    );
    const log = await prisma.auditLog.findFirst({ where: { entityId: o.id, action: "UPDATE" } });
    expect(log?.previousValues).toMatchObject({ distanceKm: 8 });
    expect(log?.newValues).toMatchObject({ distanceKm: 10 });
  });

  it("annulation par un admin : tracée, et la sortie en cours libère le bateau", async () => {
    const a = await makeUser();
    const admin = await makeUser({ role: "ADMIN" });
    const boat = await makeBoat({ rowers: 1 });
    const o = await startOuting(actorOf(a), { boatId: boat.id, crew: rowers(a.id), departureDate: TODAY, departureTime: "09:00" }, NOW);
    await cancelOuting(actorOf(admin), o.id, { reason: "Saisie en double" }, NOW);
    expect(await prisma.outing.count({ where: { boatId: boat.id, status: "IN_PROGRESS" } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: o.id, action: "CANCEL" } })).toBe(1);
  });

  it("un membre ne peut pas annuler une sortie terminée", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    const o = await createRetrospectiveOuting(
      actorOf(a),
      { date: "2026-11-12", boatId: boat.id, crew: rowers(a.id), departureTime: "08:00", returnTime: "09:00", distanceKm: "8" },
      NOW,
    );
    await expectDomainError(cancelOuting(actorOf(a), o.id, { reason: "erreur" }, NOW), "FORBIDDEN");
  });
});
