import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getMemberStats } from "@/lib/services/stats";
import { ROLE_LABELS } from "@/lib/services/members";
import { canManageMembers } from "@/lib/permissions";
import { resolvePeriod } from "@/lib/periods";
import { formatDate } from "@/lib/time";
import { formatInt, formatKm, initials } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/stats/period-filter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MemberFormDialog } from "@/components/members/member-form-dialog";

export const metadata = { title: "Membres" };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; du?: string; au?: string; inactifs?: string }>;
}) {
  const user = await requireUser();
  const admin = canManageMembers(user);
  const sp = await searchParams;
  const range = resolvePeriod({ period: sp.periode, from: sp.du, to: sp.au }, "year");
  const showInactive = sp.inactifs === "1";
  const [users, stats] = await Promise.all([
    prisma.user.findMany({
      where: showInactive ? {} : { isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    getMemberStats(range),
  ]);
  const statById = new Map(stats.map((s) => [s.userId, s]));
  const inactiveCount = await prisma.user.count({ where: { isActive: false } });
  const toggleHref = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
  if (showInactive) toggleHref.delete("inactifs");
  else toggleHref.set("inactifs", "1");

  return (
    <div>
      <PageHeader
        title="Membres"
        description={`${users.filter((u) => u.isActive).length} membres actifs`}
        actions={
          admin && (
            <MemberFormDialog
              trigger={
                <Button size="sm">
                  <Plus /> Ajouter un membre
                </Button>
              }
            />
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <PeriodFilter value={range.period} from={range.fromDate} to={range.toDate} options={["30d", "month", "year", "12m", "all", "custom"]} />
        {inactiveCount > 0 && (
          <Link href={`/membres?${toggleHref.toString()}`} className="text-link text-sm hover:underline">
            {showInactive ? "Masquer les anciens membres" : `Afficher les anciens membres (${inactiveCount})`}
          </Link>
        )}
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Membre</TableHead>
              {admin && <TableHead className="hidden lg:table-cell">E-mail</TableHead>}
              <TableHead className="hidden sm:table-cell">Rôle</TableHead>
              <TableHead className="text-right">Sorties</TableHead>
              <TableHead className="text-right">Km</TableHead>
              <TableHead className="hidden md:table-cell">Dernière sortie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const s = statById.get(u.id);
              return (
                <TableRow key={u.id} className={u.isActive ? "relative" : "text-muted-foreground relative"}>
                  <TableCell>
                    <Link href={`/membres/${u.id}`} className="flex items-center gap-2.5 after:absolute after:inset-0">
                      <span className="bg-secondary text-secondary-foreground flex size-7 items-center justify-center rounded-full text-[11px] font-semibold">
                        {initials(u.firstName, u.lastName)}
                      </span>
                      <span className="font-medium">
                        {u.firstName} {u.lastName}
                      </span>
                      {!u.isActive && <Badge variant="muted">Inactif</Badge>}
                    </Link>
                  </TableCell>
                  {admin && <TableCell className="text-muted-foreground hidden lg:table-cell">{u.email}</TableCell>}
                  <TableCell className="hidden sm:table-cell">
                    {u.role === "ADMIN" ? <Badge variant="secondary">{ROLE_LABELS.ADMIN}</Badge> : <span className="text-muted-foreground">{ROLE_LABELS.MEMBER}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatInt(s?.outings ?? 0)}</TableCell>
                  <TableCell className="text-right font-medium tabular">{formatKm(s?.km ?? 0)}</TableCell>
                  <TableCell className="hidden tabular md:table-cell">{s?.lastOutingAt ? formatDate(s.lastOutingAt) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
