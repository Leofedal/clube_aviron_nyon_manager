"use client";
import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { PERIOD_OPTIONS, type PeriodKey } from "@/lib/periods";

/** Filtre de période (segments) — met à jour ?periode=&du=&au= dans l'URL. */
export function PeriodFilter({
  value,
  from,
  to,
  options = ["today", "7d", "30d", "month", "year", "custom"],
}: {
  value: PeriodKey;
  from: string;
  to: string;
  options?: PeriodKey[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="bg-muted -mx-1 flex max-w-full overflow-x-auto rounded-lg p-1 sm:mx-0" role="group" aria-label="Période">
        {PERIOD_OPTIONS.filter((o) => options.includes(o.value)).map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() =>
              go(o.value === "custom" ? { periode: "custom", du: from, au: to } : { periode: o.value, du: null, au: null })
            }
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm",
              value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={value === o.value}
          >
            {o.value === "custom" ? "Personnalisée" : o.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" className="h-8 w-auto" value={from} onChange={(e) => go({ du: e.target.value })} aria-label="Du" />
          <span className="text-muted-foreground text-sm">→</span>
          <Input type="date" className="h-8 w-auto" value={to} onChange={(e) => go({ au: e.target.value })} aria-label="Au" />
        </div>
      )}
      {pending && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
    </div>
  );
}
