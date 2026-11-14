import { describe, expect, it } from "vitest";
import { sunTimes } from "@/lib/sun";
import { compassPoint, localWindName, windLevel } from "@/lib/wind";
import { parseOpenMeteo } from "@/lib/weather";
import { formatTime } from "@/lib/time";

const NYON = { lat: 46.3833, lon: 6.2398 };
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe("lever et coucher du soleil à Nyon", () => {
  it("14 novembre : coucher vers 17:05, lever vers 07:36 (heure d'hiver)", () => {
    const t = sunTimes("2026-11-14", NYON.lat, NYON.lon)!;
    expect(Math.abs(minutes(formatTime(t.sunset)) - minutes("17:05"))).toBeLessThanOrEqual(4);
    expect(Math.abs(minutes(formatTime(t.sunrise)) - minutes("07:36"))).toBeLessThanOrEqual(4);
  });
  it("21 décembre : coucher le plus tôt de l'année, vers 16:52", () => {
    const t = sunTimes("2026-12-21", NYON.lat, NYON.lon)!;
    expect(Math.abs(minutes(formatTime(t.sunset)) - minutes("16:52"))).toBeLessThanOrEqual(4);
  });
  it("21 juin : coucher vers 21:33 (heure d'été)", () => {
    const t = sunTimes("2026-06-21", NYON.lat, NYON.lon)!;
    expect(Math.abs(minutes(formatTime(t.sunset)) - minutes("21:33"))).toBeLessThanOrEqual(4);
  });
});

describe("vent", () => {
  it("points cardinaux", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(45)).toBe("NE");
    expect(compassPoint(225)).toBe("SO");
    expect(compassPoint(359)).toBe("N");
  });
  it("vents locaux du Léman", () => {
    expect(localWindName(45, 20)).toBe("Bise");
    expect(localWindName(230, 20)).toBe("Vent (sud-ouest)");
    expect(localWindName(310, 20)).toBe("Joran");
    expect(localWindName(45, 3)).toBeNull(); // vent trop faible
  });
  it("niveaux pour l'aviron (vent moyen ou rafales)", () => {
    expect(windLevel(5, 10).level).toBe("calm");
    expect(windLevel(14, 18).level).toBe("moderate");
    expect(windLevel(10, 35).level).toBe("strong"); // rafales seules
    expect(windLevel(32, 40).level).toBe("danger");
  });
});

describe("lecture de la réponse Open-Meteo", () => {
  const sample = {
    current: { time: "2026-11-14T14:45", temperature_2m: 7.6, wind_speed_10m: 7.6, wind_gusts_10m: 20.2, wind_direction_10m: 82, weather_code: 0 },
    hourly: {
      time: ["2026-11-14T14:00", "2026-11-14T15:00", "2026-11-14T16:00"],
      wind_speed_10m: [7, 9.4, 12.6],
      wind_gusts_10m: [19, 21, 28.4],
      wind_direction_10m: [80, 70, 60],
    },
  };
  it("convertit l'heure locale et ne garde que les heures à venir", () => {
    const now = new Date("2026-11-14T13:50:00Z"); // 14:50 à Nyon
    const w = parseOpenMeteo(sample, now)!;
    expect(w.current).toMatchObject({ speed: 8, gusts: 20, temperature: 8, direction: 82 });
    expect(w.nextHours.map((h) => formatTime(h.time))).toEqual(["15:00", "16:00"]);
    expect(w.nextHours[1]).toMatchObject({ speed: 13, gusts: 28 });
  });
  it("renvoie null si le service signale une erreur", () => {
    expect(parseOpenMeteo({ error: true, reason: "limit" })).toBeNull();
  });
});
