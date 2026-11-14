import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { mapDatabaseError } from "@/lib/errors";
import { makeBoat, makeUser, resetDb } from "../helpers";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function catchErr(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("aucune erreur levée");
}

describe("contraintes PostgreSQL (garde-fou ultime)", () => {
  it("index unique partiel : deuxième sortie active → BOAT_BUSY", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    const data = { boatId: boat.id, createdById: a.id, entryMode: "LIVE" as const };
    await prisma.outing.create({ data: { ...data, departureAt: new Date("2026-11-14T08:00:00Z") } });
    const e = await catchErr(prisma.outing.create({ data: { ...data, departureAt: new Date("2026-11-14T09:00:00Z") } }));
    expect(mapDatabaseError(e)?.code).toBe("BOAT_BUSY");
  });

  it("contrainte d'exclusion : chevauchement de périodes → OVERLAP", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    const base = { boatId: boat.id, createdById: a.id, entryMode: "RETROSPECTIVE" as const, status: "COMPLETED" as const, distanceKm: 5 };
    await prisma.outing.create({
      data: { ...base, departureAt: new Date("2026-11-10T08:00:00Z"), returnAt: new Date("2026-11-10T10:00:00Z") },
    });
    const e = await catchErr(
      prisma.outing.create({
        data: { ...base, departureAt: new Date("2026-11-10T09:00:00Z"), returnAt: new Date("2026-11-10T11:00:00Z") },
      }),
    );
    expect(mapDatabaseError(e)?.code).toBe("OVERLAP");
  });

  it("CHECK : retour avant départ et sortie terminée sans distance refusés", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    const base = { boatId: boat.id, createdById: a.id, entryMode: "RETROSPECTIVE" as const, status: "COMPLETED" as const };
    await expect(
      prisma.outing.create({
        data: { ...base, distanceKm: 5, departureAt: new Date("2026-11-10T10:00:00Z"), returnAt: new Date("2026-11-10T09:00:00Z") },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.outing.create({
        data: { ...base, departureAt: new Date("2026-11-10T08:00:00Z"), returnAt: new Date("2026-11-10T09:00:00Z") },
      }),
    ).rejects.toThrow();
  });
});
