import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className={cn("bg-card rounded-xl border p-4", accent && "border-live/40 bg-live/5")}>
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium sm:text-sm">
        <Icon className={cn("size-4", accent && "text-live")} />
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular sm:text-3xl">{value}</span>
        {unit && <span className="text-muted-foreground text-sm">{unit}</span>}
      </div>
      {hint && <div className="text-muted-foreground mt-1 text-xs">{hint}</div>}
    </div>
  );
}
