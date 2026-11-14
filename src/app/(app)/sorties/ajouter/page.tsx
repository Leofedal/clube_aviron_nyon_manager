import { requireUser } from "@/lib/auth/session";
import { loadPickerData } from "@/lib/picker-data";
import { toLocalDateString } from "@/lib/time";
import { isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { OutingForm } from "@/components/outings/outing-form";

export const metadata = { title: "Ajouter une sortie passée" };

export default async function AddPastOutingPage() {
  const user = await requireUser();
  const admin = isAdmin(user);
  // Les administrateurs peuvent saisir des archives incluant d'anciens membres.
  const { boats, members } = await loadPickerData({ includeInactiveMembers: admin });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Ajouter une sortie passée"
        description="Enregistrez une sortie déjà effectuée. Elle sera comptée exactement comme une sortie saisie en temps réel."
      />
      <OutingForm
        mode={{ kind: "create" }}
        boats={boats}
        members={members.map((m) => ({ ...m, busyOn: null }))}
        currentUserId={user.id}
        isAdmin={admin}
        defaults={{
          date: toLocalDateString(new Date()),
          boatId: "",
          crew: [{ userId: user.id, crewRole: "ROWER" }],
          direction: null,
          departureTime: "",
          returnTime: "",
          distanceKm: "",
          notes: "",
        }}
      />
    </div>
  );
}
