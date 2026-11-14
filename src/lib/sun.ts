/**
 * Lever / coucher du soleil (équation du lever du soleil, précision ~1–2 min).
 * Calcul local : fonctionne même si le service météo est indisponible.
 */
const RAD = Math.PI / 180;
const J1970 = 2440587.5;
const J2000 = 2451545.0;

const toJulian = (d: Date) => d.getTime() / 86400000 + J1970;
const fromJulian = (j: number) => new Date((j - J1970) * 86400000);

/**
 * @param date jour civil "yyyy-MM-dd"
 * @returns instants UTC du lever et du coucher, ou null (nuit/jour polaire)
 */
export function sunTimes(
  date: string,
  latitude: number,
  longitude: number,
): { sunrise: Date; sunset: Date } | null {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const n = Math.round(toJulian(noonUtc) - J2000 - 0.0009 + 69.184 / 86400);
  const jStar = n + 0.0009 - longitude / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = J2000 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDecl = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosDecl = Math.cos(Math.asin(sinDecl));
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(latitude * RAD) * sinDecl) / (Math.cos(latitude * RAD) * cosDecl);
  if (cosH < -1 || cosH > 1) return null;
  const h = Math.acos(cosH) / RAD;
  return { sunrise: fromJulian(jTransit - h / 360), sunset: fromJulian(jTransit + h / 360) };
}
