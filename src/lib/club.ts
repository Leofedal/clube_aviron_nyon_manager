/** Identité du club — modifier ici pour changer le nom partout dans l'application. */
export const CLUB = {
  name: "Club Aviron de Nyon",
  shortName: "Aviron Nyon",
  appName: "Gestion des sorties",
  logo: "/logo-club.png",
  /** Dimensions du fichier public/logo-club.png */
  logoWidth: 640,
  logoHeight: 340,
  /** Position du club (port de Nyon) pour la météo et le coucher du soleil */
  location: { label: "Nyon", latitude: 46.3833, longitude: 6.2398 },
} as const;
