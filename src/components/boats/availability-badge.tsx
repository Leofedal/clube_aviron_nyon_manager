import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AVAILABILITY_LABELS, type BoatAvailability } from "@/lib/services/boats";

export function AvailabilityBadge({ availability }: { availability: BoatAvailability }) {
  const variant = { AVAILABLE: "success", ON_WATER: "live", MAINTENANCE: "warning", UNAVAILABLE: "muted" } as const;
  return (
    <Badge variant={variant[availability]}>
      {availability === "ON_WATER" && <span className="bg-live size-1.5 animate-pulse rounded-full" />}
      {availability === "MAINTENANCE" && <Wrench />}
      {AVAILABILITY_LABELS[availability]}
    </Badge>
  );
}
