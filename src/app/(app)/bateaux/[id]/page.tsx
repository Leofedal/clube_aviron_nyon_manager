import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Play, QrCode } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { deriveAvailability, MAINTENANCE_LABELS } from "@/lib/services/boats";
import { getBoatStats, getMonthlySeries } from "@/lib/services/stats";
import { listOutings } from "@/lib/services/outing-queries";
import { resolvePeriod } from "@/lib/periods";
import { toOutingDTO, crewNames } from "@/lib/dto";
import { formatDate, formatDuration, formatTime } from "@/lib/time";
import { formatInt, formatKm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { StatCard } from "@/components/stats/stat-card";
import { MonthlyBarChart } from "@/components/stats/charts";
import { AvailabilityBadge } from "@/components/boats/availability-badge";
import { BoatTags } from "@/components/boats/boat-tags";
import { OutingStatusBadge } from "@/components/outings/status-badge";
import { Activity, Clock, Route, CalendarDays } from "lucide-react";

export default async function BoatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const boat = await prisma.boat.findUnique({
    where: { id },
    include: { boatType: true, outings: { where: { status: "IN_PROGRESS" }, select: { id: true } } },
  });
  if (!boat) notFound();
  const availability = deriveAvailability(boat.maintenanceStatus, boat.outings.length > 0);
  const [stats, series, history] = await Promise.all([
    getBoatStats(null).then((all) => all.find((s) => s.boatId === id)),
    getMonthlySeries(resolvePeriod({ period: "12m" }), { boatId: id }),
    listOutings({ boatId: id, pageSize: 15 }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/bateaux" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Bateaux
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <AvailabilityBadge availability={availability} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{boat.name}</h1>
          <BoatTags tags={boat.tags} className="my-1.5" />
          <p className="text-muted-foreground text-sm">
            {boat.boatType.label} {boat.boatType.code} · {boat.rowingCapacity} rameur{boat.rowingCapacity > 1 ? "s" : ""}
            {boat.coxswainCapacity > 0 && " + barreur"} · {MAINTENANCE_LABELS[boat.maintenanceStatus]}
          </p>
        </div>
        {availability === "AVAILABLE" && (
          <Button asChild>
            <Link href={`/sorties/demarrer?bateau=${boat.id}`}>
              <Play /> Démarrer une sortie avec ce bateau
            </Link>
          </Button>
        )}
      </div>

      {boat.notes && <p className="bg-muted/50 rounded-lg border px-4 py-3 text-sm whitespace-pre-wrap">{boat.notes}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Activity} label="Sorties" value={formatInt(stats?.outings ?? 0)} />
        <StatCard icon={Route} label="Kilomètres" value={formatKm(stats?.km ?? 0)} unit="km" />
        <StatCard icon={Clock} label="Temps sur l'eau" value={formatDuration(stats?.minutes ?? 0)} />
        <StatCard icon={CalendarDays} label="Dernière utilisation" value={stats?.lastUsedAt ? formatDate(stats.lastUsedAt) : "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kilomètres par mois (12 derniers mois)</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyBarChart data={series.map((s) => ({ month: s.month, km: s.km }))} dataKey="km" unit="km" height={200} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des sorties</CardTitle>
          <CardAction>
            <Link href={`/sorties?bateau=${boat.id}`} className="text-link text-sm hover:underline">
              Tout voir ({history.total})
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="-mx-2 divide-y">
            {history.items.map((raw) => {
              const o = toOutingDTO(raw);
              return (
                <li key={o.id}>
                  <Link href={`/sorties/${o.id}`} className="hover:bg-muted/50 flex items-center gap-3 rounded-md px-2 py-2.5 text-sm">
                    <span className="w-20 tabular">{formatDate(new Date(o.departureAt))}</span>
                    <span className="text-muted-foreground hidden w-24 tabular sm:inline">
                      {formatTime(new Date(o.departureAt))} → {o.returnAt ? formatTime(new Date(o.returnAt)) : "…"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{crewNames(o.crew)}</span>
                    <span className="font-medium tabular">{o.distanceKm != null ? `${formatKm(o.distanceKm)} km` : ""}</span>
                    <OutingStatusBadge status={o.status} />
                  </Link>
                </li>
              );
            })}
            {history.items.length === 0 && <li className="text-muted-foreground py-6 text-center text-sm">Aucune sortie.</li>}
          </ul>
        </CardContent>
      </Card>

      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <QrCode className="size-4" /> Lien de départ rapide (pour un futur QR code sur le bateau) :{" "}
        <code className="bg-muted rounded px-1.5 py-0.5">/sorties/demarrer?bateau={boat.id}</code>
      </p>
    </div>
  );
}
