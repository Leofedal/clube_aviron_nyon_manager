import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cancelOuting, createRetrospectiveOuting, finishOuting, startOuting, updateOuting } from "@/lib/services/outings";
import { getBoatStats, getClubSummary, getDirectionStats, getMemberStats, getMemberSummary, getMonthlySeries } from "@/lib/services/stats";
import { listOutings } from "@/lib/services/outing-queries";
import { rangeFromDates, resolvePeriod } from "@/lib/periods";
import { actorOf, makeBoat, makeUser, resetDb, rowers } from "../helpers";

const NOW = new Date("2026-11-14T10:00:00Z");
const NOV = resolvePeriod({ period: "month" }, "month", NOW);

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

async function crewOfFour() {
  const users = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()]);
  const cox = await makeUser();
  const boat = await makeBoat({ rowers: 4, cox: 1 });
  return { users, cox, boat };
}

describe("calcul des distances", () => {
  it("équipage de 4 sur 15 km : 15 km chacun, 15 km pour le bateau, 15 km pour le club (pas 60)", async () => {
    const { users, boat } = await crewOfFour();
    await createRetrospectiveOuting(
      actorOf(users[0]),
      { direction: "LAUSANNE" as const, date: "2026-11-10", boatId: boat.id, crew: rowers(...users.map((u) => u.id)), departureTime: "08:00", returnTime: "09:30", distanceKm: "15" },
      NOW,
    );
    const club = await getClubSummary(NOV);
    expect(club.km).toBe(15);
    expect(club.outings).toBe(1);
    expect(club.activeRowers).toBe(4);
    const members = await getMemberStats(NOV);
    for (const u of users) expect(members.find((m) => m.userId === u.id)?.km).toBe(15);
    const boats = await getBoatStats(NOV);
    expect(boats.find((b) => b.boatId === boat.id)?.km).toBe(15);
  });

  it("le barreur est comptabilisé séparément (km barrés vs ramés)", async () => {
    const { users, cox, boat } = await crewOfFour();
    await createRetrospectiveOuting(
      actorOf(users[0]),
      {
        direction: "GENEVA" as const,
        date: "2026-11-10",
        boatId: boat.id,
        crew: [...rowers(...users.map((u) => u.id)), { userId: cox.id, crewRole: "COXSWAIN" }],
        departureTime: "08:00",
        returnTime: "09:30",
        distanceKm: "12.5",
      },
      NOW,
    );
    const c = await getMemberSummary(cox.id, NOV);
    expect(c).toMatchObject({ km: 12.5, kmCoxed: 12.5, kmRowed: 0 });
    const r = await getMemberSummary(users[0].id, NOV);
    expect(r).toMatchObject({ km: 12.5, kmCoxed: 0, kmRowed: 12.5 });
  });

  it("une sortie en cours ne compte pas ; elle compte dès qu'elle est terminée (comme une rétrospective)", async () => {
    const a = await makeUser();
    const [b1, b2] = [await makeBoat({ rowers: 1 }), await makeBoat({ rowers: 1 })];
    const live = await startOuting(actorOf(a), { direction: "LAUSANNE" as const, boatId: b1.id, crew: rowers(a.id), departureDate: "2026-11-14", departureTime: "08:00" }, NOW);
    expect((await getClubSummary(NOV)).km).toBe(0);
    await finishOuting(actorOf(a), live.id, { returnDate: "2026-11-14", returnTime: "10:00", distanceKm: "10" }, NOW);
    const b = await makeUser();
    await createRetrospectiveOuting(
      actorOf(b),
      { direction: "LAUSANNE" as const, date: "2026-11-13", boatId: b2.id, crew: rowers(b.id), departureTime: "08:00", returnTime: "10:00", distanceKm: "10" },
      NOW,
    );
    const club = await getClubSummary(NOV);
    expect(club).toMatchObject({ km: 20, outings: 2, minutes: 240 });
  });

  it("les sorties annulées ne sont pas comptabilisées", async () => {
    const a = await makeUser();
    const admin = await makeUser({ role: "ADMIN" });
    const boat = await makeBoat({ rowers: 1 });
    const o = await createRetrospectiveOuting(
      actorOf(a),
      { direction: "LAUSANNE" as const, date: "2026-11-10", boatId: boat.id, crew: rowers(a.id), departureTime: "08:00", returnTime: "09:00", distanceKm: "9" },
      NOW,
    );
    await cancelOuting(actorOf(admin), o.id, { reason: "Doublon" }, NOW);
    expect((await getClubSummary(NOV)).km).toBe(0);
    expect((await getMemberSummary(a.id, NOV))?.km).toBe(0);
    // le registre masque les annulées par défaut, mais peut les afficher
    expect((await listOutings({})).total).toBe(0);
    expect((await listOutings({ status: "CANCELLED" })).total).toBe(1);
  });

  it("les statistiques sont recalculées après correction des km et de l'équipage", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const admin = await makeUser({ role: "ADMIN" });
    const boat = await makeBoat({ rowers: 2 });
    const o = await createRetrospectiveOuting(
      actorOf(a),
      { direction: "LAUSANNE" as const, date: "2026-11-10", boatId: boat.id, crew: rowers(a.id), departureTime: "08:00", returnTime: "09:00", distanceKm: "8" },
      NOW,
    );
    expect((await getMemberSummary(b.id, NOV))?.km).toBe(0);
    await updateOuting(
      actorOf(admin),
      o.id,
      { direction: "LAUSANNE" as const, date: "2026-11-10", boatId: boat.id, crew: rowers(a.id, b.id), departureTime: "08:00", returnTime: "09:00", distanceKm: "11" },
      NOW,
    );
    expect((await getClubSummary(NOV)).km).toBe(11);
    expect((await getMemberSummary(a.id, NOV))?.km).toBe(11);
    expect((await getMemberSummary(b.id, NOV))?.km).toBe(11);
    // retrait d'un équipier
    await updateOuting(
      actorOf(admin),
      o.id,
      { direction: "LAUSANNE" as const, date: "2026-11-10", boatId: boat.id, crew: rowers(b.id), departureTime: "08:00", returnTime: "09:00", distanceKm: "11" },
      NOW,
    );
    expect((await getMemberSummary(a.id, NOV))?.km).toBe(0);
    expect((await getClubSummary(NOV)).activeRowers).toBe(1);
  });
});

describe("filtrage par date", () => {
  it("attribue la sortie à sa date de départ locale (minuit, fin de mois)", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    // Départ le 31/10 à 23:30 (Zurich), retour le 01/11 → compte en octobre
    await createRetrospectiveOuting(
      actorOf(a),
      { direction: "LAUSANNE" as const, date: "2026-10-31", boatId: boat.id, crew: rowers(a.id), departureTime: "23:30", returnTime: "00:30", distanceKm: "6" },
      NOW,
    );
    // Départ le 01/11 à 00:30 local (= 31/10 23:30 UTC) → compte en novembre
    await createRetrospectiveOuting(
      actorOf(a),
      { direction: "LAUSANNE" as const, date: "2026-11-01", boatId: boat.id, crew: rowers(a.id), departureTime: "00:45", returnTime: "02:00", distanceKm: "4" },
      NOW,
    );
    expect((await getClubSummary(rangeFromDates("2026-10-01", "2026-10-31"))).km).toBe(6);
    expect((await getClubSummary(NOV)).km).toBe(4);
    const series = await getMonthlySeries(rangeFromDates("2026-09-01", "2026-11-30"));
    expect(series.map((p) => [p.month, p.km])).toEqual([
      ["2026-09", 0],
      ["2026-10", 6],
      ["2026-11", 4],
    ]);
    const reg = await listOutings({ range: rangeFromDates("2026-11-01", "2026-11-01") });
    expect(reg.total).toBe(1);
  });

  it("registre : filtres membre, bateau, recherche et tri par km", async () => {
    const [a, b] = [await makeUser({ firstName: "Juliette" }), await makeUser({ firstName: "Marc" })];
    const [b1, b2] = [await makeBoat({ rowers: 1, name: "Filippi" }), await makeBoat({ rowers: 1, name: "Empacher" })];
    await createRetrospectiveOuting(actorOf(a), { direction: "LAUSANNE" as const, date: "2026-11-10", boatId: b1.id, crew: rowers(a.id), departureTime: "08:00", returnTime: "09:00", distanceKm: "5" }, NOW);
    await createRetrospectiveOuting(actorOf(b), { direction: "LAUSANNE" as const, date: "2026-11-11", boatId: b2.id, crew: rowers(b.id), departureTime: "08:00", returnTime: "09:00", distanceKm: "12" }, NOW);
    expect((await listOutings({ memberId: a.id })).total).toBe(1);
    expect((await listOutings({ direction: "LAUSANNE" as const, boatId: b2.id })).items[0].boat.name).toBe("Empacher");
    expect((await listOutings({ q: "juliet" })).total).toBe(1);
    expect((await listOutings({ q: "filip" })).total).toBe(1);
    const sorted = await listOutings({ sort: "km", dir: "desc" });
    expect(sorted.items.map((o) => Number(o.distanceKm))).toEqual([12, 5]);
  });
});

describe("directions", () => {
  it("répartit sorties et km par direction, et filtre le registre", async () => {
    const a = await makeUser();
    const boat = await makeBoat({ rowers: 1 });
    const base = { boatId: boat.id, crew: rowers(a.id), departureTime: "08:00", returnTime: "09:00" };
    await createRetrospectiveOuting(actorOf(a), { ...base, date: "2026-11-10", direction: "GENEVA" as const, distanceKm: "10" }, NOW);
    await createRetrospectiveOuting(actorOf(a), { ...base, date: "2026-11-11", direction: "GENEVA" as const, distanceKm: "12" }, NOW);
    await createRetrospectiveOuting(actorOf(a), { ...base, date: "2026-11-12", direction: "LAUSANNE" as const, distanceKm: "8" }, NOW);
    const stats = await getDirectionStats(NOV);
    expect(stats.find((d) => d.direction === "GENEVA")).toMatchObject({ outings: 2, km: 22 });
    expect(stats.find((d) => d.direction === "LAUSANNE")).toMatchObject({ outings: 1, km: 8 });
    expect((await listOutings({ direction: "LAUSANNE" })).total).toBe(1);
  });
});
