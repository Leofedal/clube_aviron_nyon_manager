"use client";
import { useMemo, useState } from "react";
import { Search, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { formatTime } from "@/lib/time";
import type { BoatOptionDTO } from "@/lib/picker-data";

const AVAIL: Record<BoatOptionDTO["availability"], { label: string; cls: string }> = {
  AVAILABLE: { label: "Disponible", cls: "text-success" },
  ON_WATER: { label: "Sur l'eau", cls: "text-live" },
  MAINTENANCE: { label: "En maintenance", cls: "text-warning" },
  UNAVAILABLE: { label: "Indisponible", cls: "text-muted-foreground" },
};

export function BoatPicker({
  boats,
  value,
  onSelect,
}: {
  boats: BoatOptionDTO[];
  value: string | null;
  onSelect: (boat: BoatOptionDTO) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? boats.filter((b) => `${b.name} ${b.typeCode} ${b.typeLabel}`.toLowerCase().includes(q)) : boats;
  }, [boats, query]);

  return (
    <div className="flex flex-col gap-3">
      {boats.length > 6 && (
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un bateau…" className="pl-9" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => {
          const available = b.availability === "AVAILABLE";
          const selected = value === b.id;
          return (
            <button
              key={b.id}
              type="button"
              disabled={!available}
              onClick={() => onSelect(b)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
                available && "hover:border-primary/50 hover:bg-accent/40 active:scale-[0.99]",
                selected && "border-primary bg-accent/60 ring-primary/30 ring-2",
                !available && "bg-muted/40 cursor-not-allowed opacity-70",
              )}
            >
              <span className="bg-secondary text-secondary-foreground flex h-10 min-w-12 items-center justify-center rounded-lg px-2 text-sm font-bold">
                {b.typeCode}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{b.name}</span>
                <span className="text-muted-foreground block text-xs">
                  {b.typeLabel} · {b.rowingCapacity} rameur{b.rowingCapacity > 1 ? "s" : ""}
                  {b.coxswainCapacity > 0 && " + barreur"}
                </span>
                <span className={cn("mt-1 block text-xs font-medium", AVAIL[b.availability].cls)}>
                  {b.availability === "MAINTENANCE" && <Wrench className="mr-1 inline size-3 align-[-1px]" />}
                  {AVAIL[b.availability].label}
                  {b.availability === "ON_WATER" && b.activeSince && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      depuis {formatTime(new Date(b.activeSince))} · {b.activeCrew}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="text-muted-foreground py-6 text-center text-sm">Aucun bateau trouvé</p>}
    </div>
  );
}
