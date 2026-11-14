"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIOD_OPTIONS } from "@/lib/periods";

const ALL = "__all__";

export function RegistryFiltersBar({
  boats,
  members,
}: {
  boats: { id: string; name: string }[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Recherche avec léger délai
  useEffect(() => {
    if ((sp.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const period = sp.get("periode") ?? "";
  const hasFilters = ["q", "bateau", "membre", "statut", "periode"].some((k) => sp.get(k));

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (bateau, membre, commentaire)…"
            className="h-9 pl-9"
            aria-label="Rechercher"
          />
        </div>
        <FilterSelect
          label="Bateau"
          value={sp.get("bateau") ?? ALL}
          onChange={(v) => update({ bateau: v })}
          options={boats.map((b) => ({ value: b.id, label: b.name }))}
        />
        <FilterSelect
          label="Membre"
          value={sp.get("membre") ?? ALL}
          onChange={(v) => update({ membre: v })}
          options={members.map((m) => ({ value: m.id, label: m.name }))}
        />
        <FilterSelect
          label="Statut"
          value={sp.get("statut") || ALL}
          onChange={(v) => update({ statut: v })}
          allLabel="En cours + terminées"
          options={[
            { value: "IN_PROGRESS", label: "En cours" },
            { value: "COMPLETED", label: "Terminées" },
            { value: "CANCELLED", label: "Annulées" },
            { value: "ALL", label: "Toutes (y c. annulées)" },
          ]}
        />
        <FilterSelect
          label="Période"
          value={period || ALL}
          onChange={(v) => update({ periode: v, ...(v !== "custom" ? { du: null, au: null } : {}) })}
          allLabel="Toutes les dates"
          options={PERIOD_OPTIONS.filter((p) => p.value !== "all").map((p) => ({ value: p.value, label: p.label }))}
        />
        {period === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              className="h-9 w-auto"
              value={sp.get("du") ?? ""}
              onChange={(e) => update({ du: e.target.value })}
              aria-label="Du"
            />
            <span className="text-muted-foreground text-sm">→</span>
            <Input
              type="date"
              className="h-9 w-auto"
              value={sp.get("au") ?? ""}
              onChange={(e) => update({ au: e.target.value })}
              aria-label="Au"
            />
          </div>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
          >
            <X /> Réinitialiser
          </Button>
        )}
        {pending && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="min-w-0 data-[placeholder]:text-muted-foreground" aria-label={label}>
        <span className="text-muted-foreground text-xs">{label} :</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel ?? "Tous"}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
