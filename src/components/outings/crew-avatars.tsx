import { cn, initials } from "@/lib/utils";
import type { CrewDTO } from "@/lib/dto";

export function CrewAvatars({ crew, max = 4, className }: { crew: CrewDTO[]; max?: number; className?: string }) {
  const shown = crew.slice(0, max);
  return (
    <div className={cn("flex -space-x-1", className)}>
      {shown.map((c) => (
        <span
          key={c.userId}
          title={`${c.firstName} ${c.lastName}${c.crewRole === "COXSWAIN" ? " (barreur)" : ""}`}
          className={cn(
            "ring-background flex size-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2",
            c.crewRole === "COXSWAIN" ? "bg-warning/25 text-foreground" : "bg-secondary text-secondary-foreground",
          )}
        >
          {initials(c.firstName, c.lastName)}
        </span>
      ))}
      {crew.length > max && (
        <span className="bg-muted text-muted-foreground ring-background flex size-7 items-center justify-center rounded-full text-[10px] font-semibold ring-2">
          +{crew.length - max}
        </span>
      )}
    </div>
  );
}
