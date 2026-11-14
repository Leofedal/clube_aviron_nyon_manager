import { requireUser } from "@/lib/auth/session";
import { loadPickerData } from "@/lib/picker-data";
import { toLocalDateString, toLocalTimeString } from "@/lib/time";
import { StartOutingWizard } from "./start-wizard";

export const metadata = { title: "Démarrer une sortie" };

export default async function StartOutingPage({ searchParams }: { searchParams: Promise<{ bateau?: string }> }) {
  const user = await requireUser();
  const { bateau } = await searchParams;
  const { boats, members } = await loadPickerData();
  const now = new Date();
  return (
    <StartOutingWizard
      boats={boats}
      members={members}
      currentUserId={user.id}
      initialBoatId={boats.find((b) => b.id === bateau && b.availability === "AVAILABLE")?.id ?? null}
      serverNow={{ date: toLocalDateString(now), time: toLocalTimeString(now) }}
    />
  );
}
