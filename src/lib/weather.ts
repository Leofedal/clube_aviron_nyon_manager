import "server-only";
import { CLUB } from "@/lib/club";
import { fromLocalDateTime, toLocalDateString } from "@/lib/time";
import { sunTimes } from "@/lib/sun";

/**
 * Météo du club via Open-Meteo (gratuit, sans clé ; modèles MétéoSuisse inclus en Suisse).
 * - réponse mise en cache 10 minutes côté serveur (limite le nombre d'appels) ;
 * - délai maximal de 5 s ; en cas d'échec, la page s'affiche sans météo ;
 * - le coucher du soleil est toujours disponible (calcul local de secours).
 */
const REVALIDATE_SECONDS = 600;

export interface WindPoint {
  time: Date;
  speed: number;
  gusts: number;
  direction: number;
}

export interface WeatherData {
  current: WindPoint & { temperature: number; weatherCode: number };
  /** Prochaines heures (vent), à partir de l'heure suivante */
  nextHours: WindPoint[];
}

export interface SunData {
  sunrise: Date;
  sunset: Date;
  /** Lever du lendemain, utile une fois le soleil couché */
  nextSunrise: Date | null;
}

interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
    weather_code: number;
  };
  hourly?: {
    time: string[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
  };
  error?: boolean;
  reason?: string;
}

/** Heures locales Open-Meteo ("2026-11-14T15:00", fuseau Europe/Zurich) → instant UTC. */
const localIso = (s: string) => fromLocalDateTime(s.slice(0, 10), s.slice(11, 16));

/** Transforme la réponse Open-Meteo (exportée pour les tests). */
export function parseOpenMeteo(json: OpenMeteoResponse, now: Date = new Date(), hours = 6): WeatherData | null {
  const c = json.current;
  if (!c || json.error) return null;
  const nextHours: WindPoint[] = [];
  const h = json.hourly;
  if (h) {
    for (let i = 0; i < h.time.length && nextHours.length < hours; i++) {
      const t = localIso(h.time[i]);
      if (t.getTime() <= now.getTime()) continue;
      nextHours.push({
        time: t,
        speed: Math.round(h.wind_speed_10m[i]),
        gusts: Math.round(h.wind_gusts_10m[i]),
        direction: h.wind_direction_10m[i],
      });
    }
  }
  return {
    current: {
      time: localIso(c.time),
      temperature: Math.round(c.temperature_2m),
      speed: Math.round(c.wind_speed_10m),
      gusts: Math.round(c.wind_gusts_10m),
      direction: c.wind_direction_10m,
      weatherCode: c.weather_code,
    },
    nextHours,
  };
}

export async function getWeather(now: Date = new Date()): Promise<WeatherData | null> {
  const { latitude, longitude } = CLUB.location;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code",
    hourly: "wind_speed_10m,wind_gusts_10m,wind_direction_10m",
    timezone: "Europe/Zurich",
    wind_speed_unit: "kmh",
    forecast_days: "2",
  });
  try {
    // OPEN_METEO_URL : facultatif (serveur de test ou instance Open-Meteo commerciale)
    const base = process.env.OPEN_METEO_URL ?? "https://api.open-meteo.com";
    const res = await fetch(`${base}/v1/forecast?${params}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`Météo indisponible (HTTP ${res.status})`);
      return null;
    }
    return parseOpenMeteo((await res.json()) as OpenMeteoResponse, now);
  } catch (e) {
    console.warn("Météo indisponible :", (e as Error).message);
    return null;
  }
}

/** Lever / coucher du soleil à Nyon pour aujourd'hui (calcul local, toujours disponible). */
export function getSun(now: Date = new Date()): SunData | null {
  const { latitude, longitude } = CLUB.location;
  const today = toLocalDateString(now);
  const t = sunTimes(today, latitude, longitude);
  if (!t) return null;
  const tomorrow = toLocalDateString(new Date(now.getTime() + 24 * 3600 * 1000));
  return { ...t, nextSunrise: sunTimes(tomorrow, latitude, longitude)?.sunrise ?? null };
}
