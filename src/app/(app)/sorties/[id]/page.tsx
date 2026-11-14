import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Compass, Flag, Pencil, PartyPopper, Ship, Timer, UserRound } from "lucide-react";
import { DirectionLabel } from "@/components/outings/direction-label";
import { requireUser } from "@/lib/auth/session";
import { getOuting, getOutingAudit } from "@/lib/services/outing-queries";
import { canCancelOuting, canEditOuting, canFinishOuting, isAdmin } from "@/lib/permissions";
import { toOutingDTO } from "@/lib/dto";
import { formatDateTime, formatDuration, formatLongDate, formatTime } from "@/lib/time";
import { formatKm } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutingStatusBadge } from "@/components/outings/status-badge";
import { Elapsed } from "@/components/outings/elapsed";
import { CancelOutingButton } from "./cancel-button";
import { AuditTrail } from "@/components/outings/audit-trail";

export default async function OutingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { nouveau } = await searchParams;
  const outing = await getOuting(id);
  if (!outing) notFound();
  const o = toOutingDTO(outing);
  const access = {
    status: outing.status,
    createdById: outing.createdById,
    departureAt: outing.departureAt,
    createdAt: outing.createdAt,
    crewUserIds: outing.crew.map((c) => c.userId),
  };
  const canFinish = canFinishOuting(user, access);
  const canEdit = canEditOuting(user, access);
  const canCancel = canCancelOuting(user, access);
  const audit = isAdmin(user) ? await getOutingAudit(id) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/sorties" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Registre des sorties
      </Link>

      {nouveau && o.status === "IN_PROGRESS" && (
        <div className="bg-live/10 border-live/30 mb-5 flex items-start gap-3 rounded-xl border p-4">
          <PartyPopper className="text-live mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Sortie démarrée — bonne navigation !</p>
            <p className="text-muted-foreground">
              À votre retour, ouvrez l&apos;application et touchez « Terminer la sortie » (aussi visible sur l&apos;accueil).
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <OutingStatusBadge status={o.status} />
            <Badge variant="outline">{o.entryMode === "LIVE" ? "Saisie en temps réel" : "Saisie après la sortie"}</Badge>
            {outing.overlapApproved && <Badge variant="warning">Chevauchement autorisé (admin)</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {o.boatName} <span className="text-muted-foreground font-normal">· {o.boatTypeCode}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm first-letter:uppercase">{formatLongDate(outing.departureAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/sorties/${o.id}/modifier`}>
                <Pencil /> Modifier
              </Link>
            </Button>
          )}
          {canCancel && <CancelOutingButton outingId={o.id} />}
        </div>
      </div>

      {canFinish && (
        <Button asChild size="xl" className="mb-6 w-full">
          <Link href={`/sorties/${o.id}/terminer`}>
            <Flag /> Terminer la sortie
          </Link>
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat icon={Compass} label="Direction" value={<DirectionLabel direction={o.direction} />} />
        <Stat icon={CalendarClock} label="Départ" value={formatTime(outing.departureAt)} />
        <Stat icon={Flag} label="Retour" value={outing.returnAt ? formatTime(outing.returnAt) : "—"} />
        <Stat
          icon={Timer}
          label={o.status === "IN_PROGRESS" ? "Durée écoulée" : "Durée"}
          value={o.status === "IN_PROGRESS" ? <Elapsed since={o.departureAt} /> : formatDuration(o.durationMin)}
        />
        <Stat icon={Ship} label="Distance" value={o.distanceKm != null ? `${formatKm(o.distanceKm)} km` : "—"} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Équipage</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {o.crew.map((c) => (
              <li key={c.userId} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/membres/${c.userId}`} className="flex items-center gap-2 hover:underline">
                  <UserRound className="text-muted-foreground size-4" />
                  {c.firstName} {c.lastName}
                </Link>
                <Badge variant={c.crewRole === "COXSWAIN" ? "warning" : "secondary"}>
                  {c.crewRole === "COXSWAIN" ? "Barreur" : "Rameur"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {(o.notes || outing.cancelReason) && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Commentaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm whitespace-pre-wrap">
            {o.notes && <p>{o.notes}</p>}
            {outing.cancelReason && (
              <p className="text-destructive">Motif de l&apos;annulation : {outing.cancelReason}</p>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-muted-foreground mt-4 text-xs">
        Saisie par {outing.createdBy.firstName} {outing.createdBy.lastName} le {formatDateTime(outing.createdAt)}
        {outing.updatedBy && ` · dernière modification par ${outing.updatedBy.firstName} ${outing.updatedBy.lastName} le ${formatDateTime(outing.updatedAt)}`}
      </p>

      {audit.length > 0 && <AuditTrail entries={audit} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border p-3.5">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular">{value}</div>
    </div>
  );
}
