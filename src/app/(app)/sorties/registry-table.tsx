import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Ship } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { OutingStatusBadge } from "@/components/outings/status-badge";
import { Elapsed } from "@/components/outings/elapsed";
import { DirectionLabel } from "@/components/outings/direction-label";
import { crewNames, type OutingDTO } from "@/lib/dto";
import { formatDate, formatDuration, formatTime } from "@/lib/time";
import { cn, formatKm } from "@/lib/utils";
import type { RegistrySort } from "@/lib/services/outing-queries";

const COLUMNS: { key: RegistrySort | null; label: string; className?: string }[] = [
  { key: "date", label: "Date" },
  { key: "boat", label: "Bateau" },
  { key: "direction", label: "Direction" },
  { key: null, label: "Équipage" },
  { key: "departure", label: "Départ" },
  { key: "return", label: "Retour" },
  { key: "duration", label: "Durée" },
  { key: "km", label: "Km", className: "text-right" },
  { key: "status", label: "Statut" },
];

export function RegistryTable({
  outings,
  sort,
  dir,
  page,
  pageCount,
  total,
  baseQuery,
}: {
  outings: OutingDTO[];
  sort: RegistrySort;
  dir: "asc" | "desc";
  page: number;
  pageCount: number;
  total: number;
  baseQuery: string;
}) {
  const href = (changes: Record<string, string>) => {
    const p = new URLSearchParams(baseQuery);
    for (const [k, v] of Object.entries(changes)) p.set(k, v);
    return `/sorties?${p.toString()}`;
  };

  if (outings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <Ship className="text-muted-foreground size-8" />
        <p className="font-medium">Aucune sortie ne correspond à ces filtres</p>
        <p className="text-muted-foreground text-sm">Modifiez la recherche ou la période.</p>
      </div>
    );
  }

  return (
    <>
      {/* Tableau (tablette / ordinateur) */}
      <div className="bg-card hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((c) => (
                <TableHead key={c.label} className={c.className}>
                  {c.key ? (
                    <Link
                      href={href({ tri: c.key, ordre: sort === c.key && dir === "desc" ? "asc" : "desc", page: "1" })}
                      className={cn(
                        "hover:text-foreground inline-flex items-center gap-1",
                        sort === c.key && "text-foreground",
                        c.className?.includes("right") && "flex-row-reverse",
                      )}
                      scroll={false}
                    >
                      {c.label}
                      {sort === c.key ? (
                        dir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )}
                    </Link>
                  ) : (
                    c.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {outings.map((o) => {
              const dep = new Date(o.departureAt);
              return (
                <TableRow key={o.id} className={cn("group relative", o.status === "CANCELLED" && "text-muted-foreground line-through decoration-1")}>
                  <TableCell className="tabular">
                    <Link href={`/sorties/${o.id}`} className="after:absolute after:inset-0">
                      {formatDate(dep)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    {o.boatName} <span className="text-muted-foreground text-xs font-normal">{o.boatTypeCode}</span>
                  </TableCell>
                  <TableCell>
                    <DirectionLabel direction={o.direction} />
                  </TableCell>
                  <TableCell className="max-w-[18rem] truncate" title={crewNames(o.crew)}>
                    {crewNames(o.crew)}
                  </TableCell>
                  <TableCell className="tabular">{formatTime(dep)}</TableCell>
                  <TableCell className="tabular">{o.returnAt ? formatTime(new Date(o.returnAt)) : "—"}</TableCell>
                  <TableCell className="tabular">
                    {o.status === "IN_PROGRESS" ? (
                      <Elapsed since={o.departureAt} className="text-live" />
                    ) : (
                      formatDuration(o.durationMin)
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular">{formatKm(o.distanceKm)}</TableCell>
                  <TableCell>
                    <OutingStatusBadge status={o.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Cartes (mobile) */}
      <ul className="flex flex-col gap-2 md:hidden">
        {outings.map((o) => {
          const dep = new Date(o.departureAt);
          return (
            <li key={o.id}>
              <Link
                href={`/sorties/${o.id}`}
                className={cn("bg-card active:bg-accent/50 block rounded-xl border p-3.5", o.status === "CANCELLED" && "opacity-60")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {o.boatName} <span className="text-muted-foreground text-xs font-normal">{o.boatTypeCode}</span>
                    </div>
                    <div className="text-muted-foreground truncate text-sm">{crewNames(o.crew)}</div>
                    <DirectionLabel direction={o.direction} className="text-sm font-medium" />
                  </div>
                  <OutingStatusBadge status={o.status} />
                </div>
                <div className="text-muted-foreground mt-2 flex items-center gap-3 text-sm tabular">
                  <span>{formatDate(dep)}</span>
                  <span>
                    {formatTime(dep)} → {o.returnAt ? formatTime(new Date(o.returnAt)) : "…"}
                  </span>
                  <span className="text-foreground ml-auto font-semibold">
                    {o.distanceKm != null ? `${formatKm(o.distanceKm)} km` : o.status === "IN_PROGRESS" ? <Elapsed since={o.departureAt} className="text-live" /> : "—"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          Page {page} / {pageCount} · {total} sortie{total > 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} scroll={false}>
                <ChevronLeft /> Précédente
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <ChevronLeft /> Précédente
              </span>
            )}
          </Button>
          <Button asChild={page < pageCount} variant="outline" size="sm" disabled={page >= pageCount}>
            {page < pageCount ? (
              <Link href={href({ page: String(page + 1) })} scroll={false}>
                Suivante <ChevronRight />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                Suivante <ChevronRight />
              </span>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
