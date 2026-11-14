import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, Clock, Pencil, Route, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMember, ROLE_LABELS } from "@/lib/services/members";
import { getFrequentCrewmates, getMemberSummary, getMonthlySeries } from "@/lib/services/stats";
import { listOutings } from "@/lib/services/outing-queries";
import { canManageMembers } from "@/lib/permissions";
import { resolvePeriod, periodLabel } from "@/lib/periods";
import { toOutingDTO } from "@/lib/dto";
import { formatDate, formatDuration } from "@/lib/time";
import { formatInt, formatKm, initials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stats/stat-card";
import { PeriodFilter } from "@/components/stats/period-filter";
import { MonthlyBarChart } from "@/components/stats/charts";
import { OutingStatusBadge } from "@/components/outings/status-badge";
import { MemberFormDialog, ResetPasswordButton } from "@/components/members/member-form-dialog";

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periode?: string; du?: string; au?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const member = await getMember(id);
  if (!member) notFound();
  const admin = canManageMembers(user);
  const range = resolvePeriod({ period: sp.periode, from: sp.du, to: sp.au }, "year");
  const [summary, allTime, series, mates, history] = await Promise.all([
    getMemberSummary(id, range),
    getMemberSummary(id, null),
    getMonthlySeries(resolvePeriod({ period: "12m" }), { userId: id }),
    getFrequentCrewmates(id),
    listOutings({ memberId: id, pageSize: 15 }),
  ]);
  const isMe = user.id === id;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/membres" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Membres
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="bg-navy text-navy-foreground flex size-14 items-center justify-center rounded-full text-lg font-semibold">
            {initials(member.firstName, member.lastName)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {member.firstName} {member.lastName} {isMe && <span className="text-muted-foreground text-base font-normal">(moi)</span>}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={member.role === "ADMIN" ? "secondary" : "outline"}>{ROLE_LABELS[member.role]}</Badge>
              {!member.isActive && <Badge variant="muted">Inactif — historique conservé</Badge>}
              <span className="text-muted-foreground">
                {formatKm(allTime?.km ?? 0)} km au total · {formatInt(allTime?.outings ?? 0)} sorties
              </span>
            </div>
          </div>
        </div>
        {admin && (
          <div className="flex flex-wrap gap-2">
            <MemberFormDialog
              member={{
                id: member.id,
                firstName: member.firstName,
                lastName: member.lastName,
                email: member.email,
                role: member.role,
                isActive: member.isActive,
              }}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil /> Modifier
                </Button>
              }
            />
            <ResetPasswordButton memberId={member.id} name={member.firstName} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold">Statistiques — {periodLabel(range.period).toLowerCase()}</h2>
        <PeriodFilter value={range.period} from={range.fromDate} to={range.toDate} options={["30d", "month", "year", "12m", "all", "custom"]} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Route} label="Kilomètres" value={formatKm(summary?.km ?? 0)} unit="km" />
        <StatCard
          icon={Users}
          label="Ramés / barrés"
          value={`${formatKm(summary?.kmRowed ?? 0)} / ${formatKm(summary?.kmCoxed ?? 0)}`}
          unit="km"
        />
        <StatCard icon={Activity} label="Sorties" value={formatInt(summary?.outings ?? 0)} />
        <StatCard icon={Clock} label="Temps sur l'eau" value={formatDuration(summary?.minutes ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Kilomètres par mois (12 derniers mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBarChart data={series.map((s) => ({ month: s.month, km: s.km }))} dataKey="km" unit="km" height={210} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Équipiers fréquents</CardTitle>
          </CardHeader>
          <CardContent>
            {mates.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune sortie en équipage.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {mates.map((m) => (
                  <li key={m.userId} className="flex justify-between">
                    <Link href={`/membres/${m.userId}`} className="hover:underline">
                      {m.firstName} {m.lastName}
                    </Link>
                    <span className="text-muted-foreground tabular">{m.n} sorties</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des sorties</CardTitle>
          <CardAction>
            <Link href={`/sorties?membre=${member.id}`} className="text-link text-sm hover:underline">
              Tout voir ({history.total})
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="-mx-2 divide-y">
            {history.items.map((raw) => {
              const o = toOutingDTO(raw);
              const role = o.crew.find((c) => c.userId === member.id)?.crewRole;
              return (
                <li key={o.id}>
                  <Link href={`/sorties/${o.id}`} className="hover:bg-muted/50 flex items-center gap-3 rounded-md px-2 py-2.5 text-sm">
                    <span className="w-20 tabular">{formatDate(new Date(o.departureAt))}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {o.boatName}
                      {role === "COXSWAIN" && <span className="text-muted-foreground font-normal"> · barreur</span>}
                    </span>
                    <span className="text-muted-foreground hidden tabular sm:inline">{formatDuration(o.durationMin)}</span>
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
    </div>
  );
}
