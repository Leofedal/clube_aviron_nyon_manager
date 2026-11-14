import type { OutingWithDetails } from "@/lib/services/outing-queries";
import { sortCrew } from "@/lib/services/outing-queries";
import { durationMinutes } from "@/lib/time";

export interface CrewDTO {
  userId: string;
  firstName: string;
  lastName: string;
  crewRole: "ROWER" | "COXSWAIN";
  isActive: boolean;
}

export interface OutingDTO {
  id: string;
  boatId: string;
  boatName: string;
  boatTypeCode: string;
  departureAt: string;
  returnAt: string | null;
  distanceKm: number | null;
  durationMin: number | null;
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  entryMode: "LIVE" | "RETROSPECTIVE";
  notes: string | null;
  crew: CrewDTO[];
  createdById: string;
  createdAt: string;
}

export function toOutingDTO(o: OutingWithDetails): OutingDTO {
  return {
    id: o.id,
    boatId: o.boatId,
    boatName: o.boat.name,
    boatTypeCode: o.boat.boatType.code,
    departureAt: o.departureAt.toISOString(),
    returnAt: o.returnAt?.toISOString() ?? null,
    distanceKm: o.distanceKm == null ? null : Number(o.distanceKm),
    durationMin: o.returnAt ? durationMinutes(o.departureAt, o.returnAt) : null,
    status: o.status,
    entryMode: o.entryMode,
    notes: o.notes,
    crew: sortCrew(o.crew).map((c) => ({
      userId: c.userId,
      firstName: c.user.firstName,
      lastName: c.user.lastName,
      crewRole: c.crewRole,
      isActive: c.user.isActive,
    })),
    createdById: o.createdById,
    createdAt: o.createdAt.toISOString(),
  };
}

export function crewNames(crew: CrewDTO[]): string {
  return crew.map((c) => (c.crewRole === "COXSWAIN" ? `${c.firstName} (barreur)` : c.firstName)).join(", ");
}
