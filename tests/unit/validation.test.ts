import { describe, expect, it } from "vitest";
import { retrospectiveOutingSchema, finishOutingSchema } from "@/lib/validation/outing";

const valid = {
  date: "2026-11-14",
  boatId: "b",
  crew: [{ userId: "u1", crewRole: "ROWER" }],
  departureTime: "08:30",
  returnTime: "10:00",
  distanceKm: "12,5",
};

describe("validation des formulaires", () => {
  it("accepte la virgule décimale", () => {
    const r = retrospectiveOutingSchema.parse(valid);
    expect(r.distanceKm).toBe(12.5);
  });
  it("refuse une distance négative", () => {
    expect(retrospectiveOutingSchema.safeParse({ ...valid, distanceKm: "-1" }).success).toBe(false);
  });
  it("refuse un retour sans kilomètres", () => {
    const r = finishOutingSchema.safeParse({ returnDate: "2026-11-14", returnTime: "10:00", distanceKm: "" });
    expect(r.success).toBe(false);
  });
  it("refuse un équipage vide ou en double", () => {
    expect(retrospectiveOutingSchema.safeParse({ ...valid, crew: [] }).success).toBe(false);
    expect(
      retrospectiveOutingSchema.safeParse({ ...valid, crew: [valid.crew[0], valid.crew[0]] }).success,
    ).toBe(false);
  });
  it("refuse un équipage composé uniquement d'un barreur", () => {
    expect(
      retrospectiveOutingSchema.safeParse({ ...valid, crew: [{ userId: "u1", crewRole: "COXSWAIN" }] }).success,
    ).toBe(false);
  });
  it("refuse une heure invalide", () => {
    expect(retrospectiveOutingSchema.safeParse({ ...valid, departureTime: "25:00" }).success).toBe(false);
  });
});
