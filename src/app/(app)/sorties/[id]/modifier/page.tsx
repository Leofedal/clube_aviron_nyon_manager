import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOuting } from "@/lib/services/outing-queries";
import { loadPickerData } from "@/lib/picker-data";
import { canEditOuting, isAdmin } from "@/lib/permissions";
import { toLocalDateString, toLocalTimeString } from "@/lib/time";
import { PageHeader } from "@/components/layout/page-header";
import { OutingForm } from "@/components/outings/outing-form";

export const metadata = { title: "Modifier la sortie" };

export default async function EditOutingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const outing = await getOuting(id);
  if (!outing) notFound();
  const allowed = canEditOuting(user, {
    status: outing.status,
    createdById: outing.createdById,
    departureAt: outing.departureAt,
    createdAt: outing.createdAt,
    crewUserIds: outing.crew.map((c) => c.userId),
  });
  if (!allowed || outing.status === "CANCELLED") redirect(`/sorties/${id}`);
  const admin = isAdmin(user);
  const { boats, members } = await loadPickerData({ includeInactiveMembers: true });
  const crewIds = new Set(outing.crew.map((c) => c.userId));
  // Les membres désactivés ne sont proposés qu'aux admins, ou s'ils faisaient déjà partie de l'équipage.
  const pickerMembers = members
    .filter((m) => m.isActive || admin || crewIds.has(m.id))
    .map((m) => ({ ...m, busyOn: crewIds.has(m.id) ? null : m.busyOn }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Modifier la sortie"
        description={
          outing.status === "IN_PROGRESS"
            ? "Sortie en cours : vous pouvez corriger le bateau, l'équipage ou l'heure de départ."
            : "Les statistiques seront recalculées automatiquement."
        }
      />
      <OutingForm
        mode={{ kind: "edit", outingId: outing.id, status: outing.status as "IN_PROGRESS" | "COMPLETED" }}
        boats={boats}
        members={pickerMembers}
        currentUserId={user.id}
        isAdmin={admin}
        defaults={{
          date: toLocalDateString(outing.departureAt),
          boatId: outing.boatId,
          crew: outing.crew.map((c) => ({ userId: c.userId, crewRole: c.crewRole })),
          departureTime: toLocalTimeString(outing.departureAt),
          returnTime: outing.returnAt ? toLocalTimeString(outing.returnAt) : undefined,
          distanceKm: outing.distanceKm != null ? String(outing.distanceKm) : undefined,
          notes: outing.notes ?? "",
          reason: "",
        }}
      />
    </div>
  );
}
