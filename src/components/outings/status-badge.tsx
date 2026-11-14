import { Badge } from "@/components/ui/badge";

export function OutingStatusBadge({ status }: { status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }) {
  if (status === "IN_PROGRESS")
    return (
      <Badge variant="live">
        <span className="bg-live size-1.5 animate-pulse rounded-full" /> En cours
      </Badge>
    );
  if (status === "COMPLETED") return <Badge variant="success">Terminée</Badge>;
  return <Badge variant="muted">Annulée</Badge>;
}
