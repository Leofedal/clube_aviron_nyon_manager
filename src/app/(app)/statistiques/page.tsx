import Link from "next/link";
import { Activity, Gauge, Route, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getBoatStats, getClubSummary, getMemberStats, getMonthlySeries } from "@/lib/services/stats";
import { periodLabel, rangeFromDates, resolvePeriod } from "@/lib/periods";
import { toLocalDateString } from "@/lib/time";
import { formatInt, formatKm } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/stats/period-filter";
import { StatCard } from "@/components/stats/stat-card";
import { MonthlyBarChart, RankedBarChart } from "@/components/stats/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Statistiques" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ periode?: string; du?: string; au?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  let range = resolvePeriod({ period: sp.periode, from: sp.du, to: sp.au }, "12m");
  if (range.period === "all") {
    const first = await prisma.outing.findFirst({ where: { status: "COMPLETED" }, orderBy: { departureAt: "asc" } });
    range = { ...rangeFromDates(first ? toLocalDateString(first.departureAt) : range.toDate, range.toDate), period: "all" };
  }

  const [summary, series, boats, members] = await Promise.all([
    getClubSummary(range),
    getMonthlySeries(range),
    getBoatStats(range),
    getMemberStats(range),
  ]);
  const activeMembers = members.filter((m) => m.outings > 0);
  const byKm = [...activeMembers].sort((a, b) => b.km - a.km || b.outings - a.outings);
  const byOutings = [...activeMembers].sort((a, b) => b.outings - a.outings || b.km - a.km);
  const usedBoats = boats.filter((b) => b.outings > 0);
  const avg = summary.outings ? summary.km / summary.outings : 0;
  const label = periodLabel(range.period).toLowerCase();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Statistiques" description={`Club, bateaux et membres — ${label}. Sorties terminées uniquement.`} />
      <PeriodFilter value={range.period} from={range.fromDate} to={range.toDate} options={["30d", "month", "year", "12m", "all", "custom"]} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Route} label="Kilomètres du club" value={formatKm(summary.km)} unit="km" />
        <StatCard icon={Activity} label="Sorties" value={formatInt(summary.outings)} />
        <StatCard icon={Users} label="Rameurs actifs" value={formatInt(summary.activeRowers)} />
        <StatCard icon={Gauge} label="Distance moyenne" value={formatKm(avg)} unit="km / sortie" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution de l&apos;activité du club</CardTitle>
          <CardDescription>Par mois de départ (heure de Zurich)</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="km">
            <TabsList>
              <TabsTrigger value="km">Kilomètres</TabsTrigger>
              <TabsTrigger value="outings">Sorties</TabsTrigger>
              <TabsTrigger value="rowers">Rameurs actifs</TabsTrigger>
            </TabsList>
            <TabsContent value="km" className="pt-3">
              <MonthlyBarChart data={series.map((s) => ({ month: s.month, v: s.km }))} dataKey="v" unit="km" height={260} />
            </TabsContent>
            <TabsContent value="outings" className="pt-3">
              <MonthlyBarChart data={series.map((s) => ({ month: s.month, v: s.outings }))} dataKey="v" unit="sorties" height={260} />
            </TabsContent>
            <TabsContent value="rowers" className="pt-3">
              <MonthlyBarChart data={series.map((s) => ({ month: s.month, v: s.activeRowers }))} dataKey="v" unit="rameurs" height={260} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bateaux</CardTitle>
            <CardDescription>Chaque sortie compte une fois pour le bateau</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="outings">
              <TabsList>
                <TabsTrigger value="outings">Les plus utilisés</TabsTrigger>
                <TabsTrigger value="km">Distance</TabsTrigger>
              </TabsList>
              <TabsContent value="outings" className="pt-3">
                <RankedBarChart
                  data={[...usedBoats].sort((a, b) => b.outings - a.outings).map((b) => ({ label: b.name, value: b.outings }))}
                  unit="sorties"
                />
              </TabsContent>
              <TabsContent value="km" className="pt-3">
                <RankedBarChart data={usedBoats.map((b) => ({ label: b.name, value: b.km }))} unit="km" />
              </TabsContent>
            </Tabs>
            {usedBoats.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">Aucune sortie sur la période.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distance par membre</CardTitle>
            <CardDescription>Chaque membre reçoit la distance totale des sorties auxquelles il a participé (top 15)</CardDescription>
          </CardHeader>
          <CardContent>
            <RankedBarChart data={byKm.slice(0, 15).map((m) => ({ label: `${m.firstName} ${m.lastName[0]}.`, value: m.km }))} unit="km" />
            {byKm.length === 0 && <p className="text-muted-foreground py-4 text-center text-sm">Aucune sortie sur la période.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Leaderboard
          title="Classement par kilomètres"
          rows={byKm.map((m) => ({ id: m.userId, name: `${m.firstName} ${m.lastName}`, main: `${formatKm(m.km)} km`, sub: m.kmCoxed > 0 ? `dont ${formatKm(m.kmCoxed)} km barrés` : `${m.outings} sorties` }))}
        />
        <Leaderboard
          title="Classement par nombre de sorties"
          rows={byOutings.map((m) => ({ id: m.userId, name: `${m.firstName} ${m.lastName}`, main: `${m.outings} sorties`, sub: `${formatKm(m.km)} km` }))}
        />
      </div>
    </div>
  );
}

function Leaderboard({ title, rows }: { title: string; rows: { id: string; name: string; main: string; sub: string }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 pl-5">#</TableHead>
              <TableHead>Membre</TableHead>
              <TableHead className="pr-5 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 20).map((r, i) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground pl-5 tabular">{i + 1}</TableCell>
                <TableCell>
                  <Link href={`/membres/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="pr-5 text-right">
                  <div className="font-medium tabular">{r.main}</div>
                  <div className="text-muted-foreground text-xs">{r.sub}</div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground py-6 text-center">
                  Aucune sortie sur la période.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
