import { BarChart3, History, Home, ListChecks, Sailboat, ScrollText, Users } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Tableau de bord", short: "Accueil", icon: Home },
  { href: "/sorties", label: "Registre des sorties", short: "Registre", icon: ListChecks },
  { href: "/bateaux", label: "Bateaux", short: "Bateaux", icon: Sailboat },
  { href: "/membres", label: "Membres", short: "Membres", icon: Users },
  { href: "/statistiques", label: "Statistiques", short: "Stats", icon: BarChart3 },
  { href: "/journal", label: "Journal d'audit", short: "Journal", icon: ScrollText, adminOnly: true },
] as const;

export const HISTORY_ICON = History;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
