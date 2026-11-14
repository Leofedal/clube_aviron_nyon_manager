import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/permissions";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AuditLog", "OutingCrew", "Outing", "Session", "Boat", "BoatType", "User" RESTART IDENTITY CASCADE`,
  );
}

let seq = 0;
export async function makeUser(opts: { role?: "ADMIN" | "MEMBER"; firstName?: string; isActive?: boolean } = {}) {
  seq++;
  const u = await prisma.user.create({
    data: {
      firstName: opts.firstName ?? `Prénom${seq}`,
      lastName: `Nom${seq}`,
      email: `user${seq}-${Date.now()}@test.local`,
      passwordHash: "x",
      role: opts.role ?? "MEMBER",
      isActive: opts.isActive ?? true,
    },
  });
  return u;
}

export const actorOf = (u: { id: string; role: "ADMIN" | "MEMBER" }): Actor => ({ id: u.id, role: u.role });

export async function makeBoat(opts: { rowers?: number; cox?: number; name?: string; maintenance?: "AVAILABLE" | "MAINTENANCE" | "UNAVAILABLE" } = {}) {
  seq++;
  const type = await prisma.boatType.create({
    data: { code: `T${seq}`, label: `Type ${seq}`, defaultRowingCapacity: opts.rowers ?? 2, defaultCoxswainCapacity: opts.cox ?? 0 },
  });
  return prisma.boat.create({
    data: {
      name: opts.name ?? `Bateau ${seq}`,
      boatTypeId: type.id,
      rowingCapacity: opts.rowers ?? 2,
      coxswainCapacity: opts.cox ?? 0,
      maintenanceStatus: opts.maintenance ?? "AVAILABLE",
    },
  });
}

export const rowers = (...ids: string[]) => ids.map((userId) => ({ userId, crewRole: "ROWER" as const }));
