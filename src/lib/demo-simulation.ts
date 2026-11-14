import { fromLocalDateTime, toLocalDateString } from "@/lib/time";
import type { WeatherData } from "@/lib/weather";

/**
 * Mode démonstration du tableau de bord (uniquement si DEMO_LOGIN="true").
 * Paramètres d'adresse :
 *   ?heure=16:30                          simule l'heure (coucher du soleil, temps restant)
 *   ?vent=35&rafales=50&direction=230      simule le vent (km/h, degrés : d'où vient le vent)
 */
export interface DemoParams {
  heure?: string;
  vent?: string;
  rafales?: string;
  direction?: string;
}

export const isDemoMode = () => process.env.DEMO_LOGIN === "true";

const num = (v: string | undefined, min: number, max: number) => {
  if (v == null || v === "") return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

export function applyDemoSimulation(
  params: DemoParams,
  weather: WeatherData | null,
  realNow: Date = new Date(),
): { now: Date; weather: WeatherData | null; label: string | null } {
  if (!isDemoMode()) return { now: realNow, weather, label: null };
  const parts: string[] = [];

  let now = realNow;
  if (params.heure && /^([01]\d|2[0-3]):[0-5]\d$/.test(params.heure)) {
    now = fromLocalDateTime(toLocalDateString(realNow), params.heure);
    parts.push(`heure ${params.heure}`);
  }

  const speed = num(params.vent, 0, 150);
  const gusts = num(params.rafales, 0, 200);
  const direction = num(params.direction, 0, 360);
  if (speed !== undefined || gusts !== undefined || direction !== undefined) {
    const base = weather?.current ?? { time: now, temperature: 12, weatherCode: 2, speed: 0, gusts: 0, direction: 45 };
    const s = speed ?? base.speed;
    const g = Math.max(gusts ?? base.gusts, s);
    const d = direction ?? base.direction;
    weather = {
      current: { ...base, time: now, speed: s, gusts: g, direction: d },
      // Prochaines heures : le vent simulé faiblit progressivement
      nextHours: Array.from({ length: 6 }, (_, i) => ({
        time: new Date(now.getTime() + (i + 1) * 3600 * 1000 - (now.getTime() % 3600000)),
        speed: Math.max(0, Math.round(s * (1 - 0.12 * (i + 1)))),
        gusts: Math.max(0, Math.round(g * (1 - 0.12 * (i + 1)))),
        direction: d,
      })),
    };
    parts.push(`vent ${s} km/h, rafales ${g} km/h, du ${d}°`);
  }

  return { now, weather, label: parts.length ? `Simulation : ${parts.join(" · ")}` : null };
}
