import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/time";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { actionLabel, diffValues } from "@/components/outings/audit-trail";

export const metadata = { title: "Journal d'audit" };

const ENTITY_LABELS: Record<string, string> = { Outing: "Sortie", Boat: "Bateau", User: "Membre", BoatType: "Type de bateau" };
const PAGE_SIZE = 40;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; type?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.type && ENTITY_LABELS[sp.type] ? { entityType: sp.type } : {};
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number, type = sp.type) => `/journal?${new URLSearchParams({ ...(type ? { type } : {}), page: String(p) })}`;

  return (
    <div>
      <PageHeader title="Journal d'audit" description="Toutes les créations, corrections et annulations, avec leur auteur et les valeurs avant/après." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant={!sp.type ? "secondary" : "ghost"}>
          <Link href="/journal">Tout</Link>
        </Button>
        {Object.entries(ENTITY_LABELS).map(([k, v]) => (
          <Button key={k} asChild size="sm" variant={sp.type === k ? "secondary" : "ghost"}>
            <Link href={link(1, k)}>{v}s</Link>
          </Button>
        ))}
      </div>
      <ul className="bg-card divide-y rounded-xl border">
        {entries.map((e) => {
          const diff = e.action === "UPDATE" || e.action === "FINISH" || e.action === "CANCEL" ? diffValues(e.previousValues, e.newValues) : [];
          const href = e.entityType === "Outing" ? `/sorties/${e.entityId}` : e.entityType === "Boat" ? `/bateaux/${e.entityId}` : e.entityType === "User" ? `/membres/${e.entityId}` : null;
          return (
            <li key={e.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:gap-4">
              <span className="text-muted-foreground w-36 shrink-0 tabular">{formatDateTime(e.createdAt)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={e.action === "CANCEL" || e.action === "OVERLAP_OVERRIDE" ? "warning" : "outline"}>{actionLabel(e.action)}</Badge>
                  {href ? (
                    <Link href={href} className="hover:underline">
                      {ENTITY_LABELS[e.entityType] ?? e.entityType}
                    </Link>
                  ) : (
                    <span>{ENTITY_LABELS[e.entityType] ?? e.entityType}</span>
                  )}
                  <span className="text-muted-foreground">par {e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : "système"}</span>
                </div>
                {diff.length > 0 && (
                  <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                    {diff.slice(0, 6).map((d) => (
                      <li key={d.key} className="truncate">
                        <span className="font-mono">{d.key}</span> : {d.from} → <span className="text-foreground">{d.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
        {entries.length === 0 && <li className="text-muted-foreground p-8 text-center text-sm">Aucune entrée.</li>}
      </ul>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page} / {pages} · {total} entrées
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={link(page - 1)}>
                <ChevronLeft /> Précédente
              </Link>
            </Button>
          )}
          {page < pages && (
            <Button asChild variant="outline" size="sm">
              <Link href={link(page + 1)}>
                Suivante <ChevronRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
