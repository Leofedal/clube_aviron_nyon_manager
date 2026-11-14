import { listBoatsWithAvailability } from "@/lib/services/boats";
import { listMembersForPicker } from "@/lib/services/members";

export interface BoatOptionDTO {
  id: string;
  name: string;
  typeCode: string;
  typeLabel: string;
  rowingCapacity: number;
  coxswainCapacity: number;
  availability: "AVAILABLE" | "ON_WATER" | "MAINTENANCE" | "UNAVAILABLE";
  activeSince: string | null;
  activeCrew: string | null;
  notes: string | null;
  tags: string[];
}

/** Données des sélecteurs (bateaux + membres), sérialisables pour les composants client. */
export async function loadPickerData(opts: { includeInactiveMembers?: boolean } = {}) {
  const [boats, members] = await Promise.all([
    listBoatsWithAvailability(),
    listMembersForPicker({ includeInactive: opts.includeInactiveMembers }),
  ]);
  const busy = new Map<string, string>();
  for (const b of boats) for (const c of b.activeOuting?.crew ?? []) busy.set(c.userId, b.name);
  return {
    boats: boats.map<BoatOptionDTO>((b) => ({
      id: b.id,
      name: b.name,
      typeCode: b.boatType.code,
      typeLabel: b.boatType.label,
      rowingCapacity: b.rowingCapacity,
      coxswainCapacity: b.coxswainCapacity,
      availability: b.availability,
      activeSince: b.activeOuting?.departureAt.toISOString() ?? null,
      activeCrew: b.activeOuting?.crew.map((c) => c.user.firstName).join(", ") ?? null,
      notes: b.notes,
      tags: b.tags,
    })),
    members: members.map((m) => ({ ...m, busyOn: busy.get(m.id) ?? null })),
  };
}
