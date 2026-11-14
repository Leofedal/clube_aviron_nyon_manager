import { describe, expect, it } from "vitest";
import { canCancelOuting, canEditOuting, canFinishOuting, canOverrideOverlap } from "@/lib/permissions";

const admin = { id: "a", role: "ADMIN" as const };
const member = { id: "m", role: "MEMBER" as const };
const other = { id: "o", role: "MEMBER" as const };
const now = new Date("2026-11-14T10:00:00Z");
const base = {
  status: "COMPLETED" as const,
  createdById: "x",
  departureAt: new Date("2026-11-13T08:00:00Z"),
  createdAt: new Date("2026-11-13T08:00:00Z"),
  crewUserIds: ["m"],
};

describe("permissions", () => {
  it("un membre d'équipage peut terminer une sortie en cours, pas un autre membre", () => {
    const o = { ...base, status: "IN_PROGRESS" as const };
    expect(canFinishOuting(member, o)).toBe(true);
    expect(canFinishOuting(other, o)).toBe(false);
    expect(canFinishOuting(admin, o)).toBe(true);
    expect(canFinishOuting(member, base)).toBe(false); // déjà terminée
  });
  it("un membre modifie ses sorties récentes uniquement", () => {
    expect(canEditOuting(member, base, now)).toBe(true);
    expect(canEditOuting(other, base, now)).toBe(false);
    const old = { ...base, departureAt: new Date("2026-10-01T08:00:00Z") };
    expect(canEditOuting(member, old, now)).toBe(false);
    expect(canEditOuting(admin, old, now)).toBe(true);
  });
  it("une sortie annulée n'est plus modifiable", () => {
    expect(canEditOuting(admin, { ...base, status: "CANCELLED" }, now)).toBe(false);
  });
  it("annulation : admin, ou auteur d'un départ récent", () => {
    const fresh = { ...base, status: "IN_PROGRESS" as const, createdById: "m", createdAt: new Date(now.getTime() - 10 * 60000) };
    expect(canCancelOuting(member, fresh, now)).toBe(true);
    expect(canCancelOuting(member, { ...fresh, createdAt: new Date(now.getTime() - 3600000) }, now)).toBe(false);
    expect(canCancelOuting(member, base, now)).toBe(false);
    expect(canCancelOuting(admin, base, now)).toBe(true);
  });
  it("seul un admin peut forcer un chevauchement", () => {
    expect(canOverrideOverlap(admin)).toBe(true);
    expect(canOverrideOverlap(member)).toBe(false);
  });
});
