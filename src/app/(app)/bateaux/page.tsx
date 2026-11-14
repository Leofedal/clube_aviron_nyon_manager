import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listBoatTypes, listBoatsWithAvailability } from "@/lib/services/boats";
import { getBoatStats } from "@/lib/services/stats";
import { canManageBoats } from "@/lib/permissions";
import { formatDate } from "@/lib/time";
import { formatKm, formatInt } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AvailabilityBadge } from "@/components/boats/availability-badge";
import { BoatFormDialog } from "@/components/boats/boat-form-dialog";
import { BoatTypeDialog } from "@/components/boats/boat-type-dialog";
import { MaintenanceMenu } from "@/components/boats/maintenance-menu";

export const metadata = { title: "Bateaux" };

export default async function BoatsPage() {
  const user = await requireUser();
  const admin = canManageBoats(user);
  const [boats, stats, types] = await Promise.all([listBoatsWithAvailability(), getBoatStats(null), listBoatTypes()]);
  const statById = new Map(stats.map((s) => [s.boatId, s]));
  const typeDTOs = types.map((t) => ({
    id: t.id,
    code: t.code,
    label: t.label,
    defaultRowingCapacity: t.defaultRowingCapacity,
    defaultCoxswainCapacity: t.defaultCoxswainCapacity,
  }));
  const counts = {
    available: boats.filter((b) => b.availability === "AVAILABLE").length,
    onWater: boats.filter((b) => b.availability === "ON_WATER").length,
  };

  return (
    <div>
      <PageHeader
        title="Bateaux"
        description={`${boats.length} bateaux · ${counts.available} disponibles · ${counts.onWater} sur l'eau`}
        actions={
          admin && (
            <>
              <BoatTypeDialog />
              <BoatFormDialog
                types={typeDTOs}
                trigger={
                  <Button size="sm">
                    <Plus /> Ajouter un bateau
                  </Button>
                }
              />
            </>
          )
        }
      />

      <div className="bg-card hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Places</TableHead>
              <TableHead>Disponibilité</TableHead>
              <TableHead className="text-right">Sorties</TableHead>
              <TableHead className="text-right">Km</TableHead>
              <TableHead>Dernière utilisation</TableHead>
              {admin && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {boats.map((b) => {
              const s = statById.get(b.id);
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <Link href={`/bateaux/${b.id}`} className="hover:underline">
                      {b.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{b.boatType.label}</span> {b.boatType.code}
                  </TableCell>
                  <TableCell className="tabular">
                    {b.rowingCapacity}
                    {b.coxswainCapacity > 0 && " + 1 barreur"}
                  </TableCell>
                  <TableCell>
                    <AvailabilityBadge availability={b.availability} />
                  </TableCell>
                  <TableCell className="text-right tabular">{formatInt(s?.outings ?? 0)}</TableCell>
                  <TableCell className="text-right font-medium tabular">{formatKm(s?.km ?? 0)}</TableCell>
                  <TableCell className="tabular">{s?.lastUsedAt ? formatDate(s.lastUsedAt) : "—"}</TableCell>
                  {admin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <BoatFormDialog
                          types={typeDTOs}
                          boat={{
                            id: b.id,
                            name: b.name,
                            boatTypeId: b.boatTypeId,
                            rowingCapacity: b.rowingCapacity,
                            coxswainCapacity: b.coxswainCapacity,
                            maintenanceStatus: b.maintenanceStatus,
                            notes: b.notes ?? "",
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label={`Modifier ${b.name}`}>
                              <Pencil />
                            </Button>
                          }
                        />
                        <MaintenanceMenu boatId={b.id} current={b.maintenanceStatus} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-2 md:hidden">
        {boats.map((b) => {
          const s = statById.get(b.id);
          return (
            <li key={b.id} className="bg-card flex items-center gap-3 rounded-xl border p-3.5">
              <Link href={`/bateaux/${b.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="bg-secondary text-secondary-foreground flex h-10 min-w-12 items-center justify-center rounded-lg px-2 text-sm font-bold">
                  {b.boatType.code}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{b.name}</span>
                  <span className="text-muted-foreground block text-xs tabular">
                    {formatInt(s?.outings ?? 0)} sorties · {formatKm(s?.km ?? 0)} km
                  </span>
                </span>
              </Link>
              <AvailabilityBadge availability={b.availability} />
              {admin && <MaintenanceMenu boatId={b.id} current={b.maintenanceStatus} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
