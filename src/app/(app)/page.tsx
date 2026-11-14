import Link from "next/link";
import { Activity, CalendarPlus, ChevronRight, Flag, Gauge, Play, Route, Sailboat, Users, Waves } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getActiveOutings, getRecentCompletedOutings } from "@/lib/services/outing-queries";
import { countBoatsOnWater, getClubSummary, getMonthlySeries } from "@/lib/services/stats";
import { periodLabel, resolvePeriod } from "@/lib/periods";
import { canFinishOuting } from "@/lib/permissions";
import { toOutingDTO, crewNames } from "@/lib/dto";
import { formatDate, formatDuration, formatTime } from "@/lib/time";
import { formatInt, formatKm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stats/stat-card";
import { PeriodFilter } from "@/components/stats/period-filter";
import { MonthlyBarChart } from "@/components/stats/charts";
import { Elapsed } from "@/components/outings/elapsed";
import { CrewAvatars } from "@/components/outings/crew-avatars";
import { DirectionLabel } from "@/components/outings/direction-label";
import { WeatherCard } from "@/components/weather/weather-card";
import { getSun, getWeather } from "@/lib/weather";
import { applyDemoSimulation, type DemoParams } from "@/lib/demo-simulation";

type SP = Promise<
  { periode?: string; du?: string; au?: string; erreur?: string } & DemoParams
>;

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const range = resolvePeriod({ period: sp.periode, from: sp.du, to: sp.au }, "month");
  const trend = resolvePeriod({ period: "12m" });

  const [summary, onWater, active, recent, series, weather] = await Promise.all([
    getClubSummary(range),
    countBoatsOnWater(),
    getActiveOutings(),
    getRecentCompletedOutings(6),
    getMonthlySeries(trend),
    getWeather(),
  ]);
  // Mode démonstration (DEMO_LOGIN="true") : ?heure=16:30&vent=35&rafales=50&direction=230
  const demo = applyDemoSimulation(sp, weather);
  const sun = getSun(demo.now);
  const label = periodLabel(range.period).toLowerCase();
  const suffix = range.period === "month" ? "ce mois-ci" : range.period === "custom" ? `du ${formatDate(range.from)} au ${range.toDate.split("-").reverse().join("/")}` : label;

  return (
    <div className="flex flex-col gap-6">
      {sp.erreur === "acces-refuse" && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          Cette page est réservée aux administrateurs.
        </p>
      )}

      {/* Actions principales — visibles dès l'ouverture, y compris sur mobile */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Actions principales">
        <Button asChild size="xl" className="h-16 justify-start text-lg shadow-sm">
          <Link href="/sorties/demarrer">
            <span className="bg-primary-foreground/15 flex size-9 items-center justify-center rounded-lg">
              <Play className="size-5" />
            </span>
            <span className="flex flex-col items-start leading-tight">
              Démarrer une sortie
              <span className="text-xs font-normal opacity-80">Je pars maintenant</span>
            </span>
          </Link>
        </Button>
        <Button asChild size="xl" variant="outline" className="h-16 justify-start text-lg">
          <Link href="/sorties/ajouter">
            <span className="bg-secondary flex size-9 items-center justify-center rounded-lg">
              <CalendarPlus className="size-5" />
            </span>
            <span className="flex flex-col items-start leading-tight">
              Ajouter une sortie passée
              <span className="text-muted-foreground text-xs font-normal">Sortie déjà effectuée</span>
            </span>
          </Link>
        </Button>
      </section>

      {/* Météo : vent en priorité, coucher du soleil */}
      <WeatherCard weather={demo.weather} sun={sun} now={demo.now} simulation={demo.label} />

      {/* Sorties en cours */}
      <section aria-labelledby="active-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="active-title" className="flex items-center gap-2 text-lg font-semibold">
            <Waves className="text-live size-5" /> Sorties en cours
            <span className="text-muted-foreground text-sm font-normal">({active.length})</span>
          </h2>
        </div>
        {active.length === 0 ? (
          <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
            Aucun bateau sur l&apos;eau pour le moment.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((raw) => {
              const o = toOutingDTO(raw);
              const mine = canFinishOuting(user, {
                status: raw.status,
                createdById: raw.createdById,
                departureAt: raw.departureAt,
                createdAt: raw.createdAt,
                crewUserIds: raw.crew.map((c) => c.userId),
              });
              return (
                <Card key={o.id} className="border-live/30 gap-3 py-4">
                  <CardHeader className="px-4">
                    <CardTitle className="flex items-center gap-2">
                      <span className="bg-live size-2 animate-pulse rounded-full" />
                      <Link href={`/sorties/${o.id}`} className="hover:underline">
                        {o.boatName}
                      </Link>
                      <span className="text-muted-foreground text-xs font-normal">{o.boatTypeCode}</span>
                    </CardTitle>
                    <CardAction>
                      <Elapsed since={o.departureAt} className="text-live text-sm font-semibold tabular" />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 px-4">
                    <div className="flex items-center gap-2">
                      <CrewAvatars crew={o.crew} />
                      <span className="text-muted-foreground truncate text-sm">{crewNames(o.crew)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
                        Départ {formatTime(new Date(o.departureAt))}
                        <DirectionLabel direction={o.direction} className="text-foreground font-medium" />
                      </span>
                      {mine ? (
                        <Button asChild size="sm">
                          <Link href={`/sorties/${o.id}/terminer`}>
                            <Flag /> Terminer
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/sorties/${o.id}`}>Détails</Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Indicateurs */}
      <section aria-labelledby="kpi-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="kpi-title" className="text-lg font-semibold">
            Activité du club
          </h2>
          <PeriodFilter value={range.period} from={range.fromDate} to={range.toDate} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Route} label={`Kilomètres ${suffix}`} value={formatKm(summary.km)} unit="km" />
          <StatCard icon={Activity} label={`Sorties ${suffix}`} value={formatInt(summary.outings)} hint={`${formatDuration(summary.minutes)} sur l'eau`} />
          <StatCard icon={Users} label={`Rameurs actifs ${suffix}`} value={formatInt(summary.activeRowers)} />
          <StatCard icon={Sailboat} label="Bateaux sur l'eau" value={formatInt(onWater)} hint="en ce moment" accent={onWater > 0} />
        </div>
        <p className="text-muted-foreground text-xs">
          Seules les sorties terminées sont comptabilisées ; une sortie est attribuée à sa date de départ.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="text-muted-foreground size-4" /> Kilomètres par mois
            </CardTitle>
            <CardAction>
              <Link href="/statistiques" className="text-link text-sm hover:underline">
                Statistiques
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <MonthlyBarChart data={series.map((s) => ({ month: s.month, km: s.km }))} dataKey="km" unit="km" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Dernières sorties terminées</CardTitle>
            <CardAction>
              <Link href="/sorties" className="text-link text-sm hover:underline">
                Registre
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Aucune sortie terminée.</p>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {recent.map((raw) => {
                  const o = toOutingDTO(raw);
                  return (
                    <li key={o.id}>
                      <Link href={`/sorties/${o.id}`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{o.boatName}</div>
                          <div className="text-muted-foreground truncate text-xs">
                            {formatDate(new Date(o.departureAt))}
                            {o.direction && ` · ${o.direction === "GENEVA" ? "Genève" : "Lausanne"}`} · {crewNames(o.crew)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold tabular">{formatKm(o.distanceKm)} km</div>
                          <div className="text-muted-foreground text-xs tabular">{formatDuration(o.durationMin)}</div>
                        </div>
                        <ChevronRight className="text-muted-foreground size-4" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
