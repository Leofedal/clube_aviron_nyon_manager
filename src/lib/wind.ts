/**
 * Interprétation du vent pour l'aviron sur le Léman (fonctions pures, testées).
 * La direction météo indique d'où VIENT le vent (0° = du nord, 90° = de l'est).
 */

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];

/** Point cardinal français (16 secteurs) : 45° → « NE ». */
export function compassPoint(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/**
 * Nom du vent local sur le Petit-Lac (Nyon) selon sa provenance.
 * Indicatif : un vent de nord-est n'est pas toujours de la bise au sens météorologique strict.
 */
export function localWindName(deg: number, speedKmh: number): string | null {
  if (speedKmh < 6) return null;
  const d = ((deg % 360) + 360) % 360;
  if (d >= 20 && d <= 100) return "Bise";
  if (d >= 190 && d <= 260) return "Vent (sud-ouest)";
  if (d > 280 && d <= 340) return "Joran";
  return null;
}

export type WindLevel = "calm" | "moderate" | "strong" | "danger";

/** Seuils indicatifs pour l'aviron (km/h). À adapter aux consignes de sécurité du club. */
export const WIND_THRESHOLDS = {
  moderate: { speed: 12, gusts: 22 },
  strong: { speed: 20, gusts: 32 },
  danger: { speed: 30, gusts: 45 },
} as const;

export function windLevel(speedKmh: number, gustsKmh: number): { level: WindLevel; label: string; advice: string } {
  const t = WIND_THRESHOLDS;
  if (speedKmh >= t.danger.speed || gustsKmh >= t.danger.gusts)
    return { level: "danger", label: "Vent très fort", advice: "Sortie déconseillée." };
  if (speedKmh >= t.strong.speed || gustsKmh >= t.strong.gusts)
    return { level: "strong", label: "Vent fort", advice: "Prudence : vagues probables, bateaux légers déconseillés." };
  if (speedKmh >= t.moderate.speed || gustsKmh >= t.moderate.gusts)
    return { level: "moderate", label: "Vent modéré", advice: "Clapot possible, restez près des rives." };
  return { level: "calm", label: "Vent faible", advice: "Bonnes conditions pour ramer." };
}

/** Codes météo WMO → libellé français. */
export function weatherLabel(code: number): string {
  if (code === 0) return "Ciel dégagé";
  if (code <= 2) return "Partiellement nuageux";
  if (code === 3) return "Couvert";
  if (code === 45 || code === 48) return "Brouillard";
  if (code >= 51 && code <= 57) return "Bruine";
  if (code >= 61 && code <= 67) return "Pluie";
  if (code >= 71 && code <= 77) return "Neige";
  if (code >= 80 && code <= 82) return "Averses";
  if (code >= 85 && code <= 86) return "Averses de neige";
  if (code >= 95) return "Orage";
  return "—";
}

export type WeatherIcon = "sun" | "cloud-sun" | "cloud" | "fog" | "rain" | "snow" | "storm";

export function weatherIcon(code: number): WeatherIcon {
  if (code === 0) return "sun";
  if (code <= 2) return "cloud-sun";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloud";
}
