import Link from "next/link";
import { CalendarPlus, Download, Play } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listOutings } from "@/lib/services/outing-queries";
import { listBoatsWithAvailability } from "@/lib/services/boats";
import { listMembersForPicker } from "@/lib/services/members";
import { canExport } from "@/lib/permissions";
import { toOutingDTO } from "@/lib/dto";
import { parseRegistryParams, type RawParams } from "@/lib/registry-params";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RegistryFiltersBar } from "./registry-filters";
import { RegistryTable } from "./registry-table";

export const metadata = { title: "Registre des sorties" };

export default async function RegistryPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = parseRegistryParams(sp);
  const [result, boats, members] = await Promise.all([
    listOutings(filters),
    listBoatsWithAvailability({ includeArchived: true }),
    listMembersForPicker({ includeInactive: true }),
  ]);
  const query = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && v ? [[k, v]] : [])),
  );
  query.delete("page");

  return (
    <div>
      <PageHeader
        title="Registre des sorties"
        description={`${result.total} sortie${result.total > 1 ? "s" : ""} — saisies en temps réel et après coup réunies dans un même registre.`}
        actions={
          <>
            {canExport(user) && (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/export/sorties?${query.toString()}`} download>
                  <Download /> Export CSV
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/sorties/ajouter">
                <CalendarPlus /> Sortie passée
              </Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/sorties/demarrer">
                <Play /> Démarrer
              </Link>
            </Button>
          </>
        }
      />
      <RegistryFiltersBar
        boats={boats.map((b) => ({ id: b.id, name: b.name }))}
        members={members.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` }))}
      />
      <RegistryTable
        outings={result.items.map(toOutingDTO)}
        sort={filters.sort!}
        dir={filters.dir!}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        baseQuery={query.toString()}
      />
    </div>
  );
}
