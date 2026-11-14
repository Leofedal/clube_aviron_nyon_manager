import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canExport } from "@/lib/permissions";
import { listOutingsForExport, STATUS_LABELS, sortCrew } from "@/lib/services/outing-queries";
import { parseRegistryParams } from "@/lib/registry-params";
import { durationMinutes, formatDate, formatTime, toLocalDateString } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Échappe une valeur CSV (séparateur « ; » pour Excel en français) et neutralise les formules. */
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canExport(user)) return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filters = parseRegistryParams(sp);
  const outings = await listOutingsForExport(filters);

  const header = ["Date", "Bateau", "Type", "Direction", "Équipage", "Barreur", "Départ", "Retour", "Durée (min)", "Km", "Statut", "Mode de saisie", "Commentaire", "Saisie par", "Identifiant"];
  const lines = [header.map(cell).join(";")];
  for (const o of outings) {
    const crew = sortCrew(o.crew);
    lines.push(
      [
        formatDate(o.departureAt),
        o.boat.name,
        o.boat.boatType.code,
        o.direction === "GENEVA" ? "Genève" : o.direction === "LAUSANNE" ? "Lausanne" : "",
        crew.filter((c) => c.crewRole === "ROWER").map((c) => `${c.user.firstName} ${c.user.lastName}`).join(", "),
        crew.filter((c) => c.crewRole === "COXSWAIN").map((c) => `${c.user.firstName} ${c.user.lastName}`).join(", "),
        formatTime(o.departureAt),
        o.returnAt ? `${toLocalDateString(o.returnAt) !== toLocalDateString(o.departureAt) ? formatDate(o.returnAt) + " " : ""}${formatTime(o.returnAt)}` : "",
        o.returnAt ? durationMinutes(o.departureAt, o.returnAt) : "",
        o.distanceKm != null ? String(o.distanceKm).replace(".", ",") : "",
        STATUS_LABELS[o.status],
        o.entryMode === "LIVE" ? "Temps réel" : "Après coup",
        o.notes ?? "",
        `${o.createdBy.firstName} ${o.createdBy.lastName}`,
        o.id,
      ]
        .map(cell)
        .join(";"),
    );
  }
  // BOM UTF-8 pour un affichage correct des accents dans Excel
  const body = "﻿" + lines.join("\r\n");
  const filename = `sorties-${toLocalDateString(new Date())}.csv`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
