import { describe, expect, it } from "vitest";
import { formatDuration, fromLocalDateTime, resolveOutingTimes, toLocalDateString, formatTime } from "@/lib/time";
import { resolvePeriod } from "@/lib/periods";

describe("fuseau horaire Europe/Zurich", () => {
  it("convertit l'heure d'hiver (UTC+1)", () => {
    expect(fromLocalDateTime("2026-11-14", "08:30").toISOString()).toBe("2026-11-14T07:30:00.000Z");
  });
  it("convertit l'heure d'été (UTC+2)", () => {
    expect(fromLocalDateTime("2026-07-01", "08:30").toISOString()).toBe("2026-07-01T06:30:00.000Z");
  });
  it("affiche en heure locale", () => {
    expect(formatTime(new Date("2026-07-01T06:30:00Z"))).toBe("08:30");
    expect(toLocalDateString(new Date("2026-11-13T23:30:00Z"))).toBe("2026-11-14");
  });
});

describe("résolution des heures d'une sortie", () => {
  it("sortie normale", () => {
    const r = resolveOutingTimes("2026-11-14", "08:30", "10:00");
    expect(r.crossesMidnight).toBe(false);
    expect((r.returnAt.getTime() - r.departureAt.getTime()) / 60000).toBe(90);
  });
  it("sortie traversant minuit : retour le lendemain", () => {
    const r = resolveOutingTimes("2026-11-13", "23:00", "01:00");
    expect(r.crossesMidnight).toBe(true);
    expect(r.departureAt.toISOString()).toBe("2026-11-13T22:00:00.000Z");
    expect(r.returnAt.toISOString()).toBe("2026-11-14T00:00:00.000Z");
  });
  it("passage à l'heure d'été (29/03/2026) : 01:30 → 03:30 ne dure qu'une heure", () => {
    const r = resolveOutingTimes("2026-03-29", "01:30", "03:30");
    expect((r.returnAt.getTime() - r.departureAt.getTime()) / 60000).toBe(60);
  });
  it("passage à l'heure d'hiver (25/10/2026) : 01:30 → 03:30 dure trois heures", () => {
    const r = resolveOutingTimes("2026-10-25", "01:30", "03:30");
    expect((r.returnAt.getTime() - r.departureAt.getTime()) / 60000).toBe(180);
  });
  it("formate les durées", () => {
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(null)).toBe("—");
  });
});

describe("périodes de filtrage", () => {
  const now = new Date("2026-11-14T10:00:00Z");
  it("aujourd'hui = journée locale complète", () => {
    const r = resolvePeriod({ period: "today" }, "month", now);
    expect(r.from.toISOString()).toBe("2026-11-13T23:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-11-14T23:00:00.000Z");
  });
  it("ce mois", () => {
    const r = resolvePeriod({ period: "month" }, "month", now);
    expect(r.fromDate).toBe("2026-11-01");
    expect(r.toDate).toBe("2026-11-30");
  });
  it("7 derniers jours inclut aujourd'hui", () => {
    const r = resolvePeriod({ period: "7d" }, "month", now);
    expect(r.fromDate).toBe("2026-11-08");
    expect(r.toDate).toBe("2026-11-14");
  });
  it("période personnalisée (bornes inversées corrigées)", () => {
    const r = resolvePeriod({ period: "custom", from: "2026-06-30", to: "2026-06-01" }, "month", now);
    expect(r.fromDate).toBe("2026-06-01");
    expect(r.to.toISOString()).toBe("2026-06-30T22:00:00.000Z"); // 01/07 00:00 heure d'été
  });
  it("valeur inconnue → valeur par défaut", () => {
    expect(resolvePeriod({ period: "n'importe quoi" }, "year", now).period).toBe("year");
  });
});
