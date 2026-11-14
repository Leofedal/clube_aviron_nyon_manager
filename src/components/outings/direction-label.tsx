import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** « ← Genève » / « Lausanne → » ; « — » si la direction n'est pas renseignée. */
export function DirectionLabel({
  direction,
  className,
}: {
  direction: "GENEVA" | "LAUSANNE" | null | undefined;
  className?: string;
}) {
  if (!direction) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      {direction === "GENEVA" ? (
        <>
          <ArrowLeft className="size-3.5 shrink-0" /> Genève
        </>
      ) : (
        <>
          Lausanne <ArrowRight className="size-3.5 shrink-0" />
        </>
      )}
    </span>
  );
}
