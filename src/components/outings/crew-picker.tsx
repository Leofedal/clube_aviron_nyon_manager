"use client";
import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { CrewMemberInput } from "@/lib/validation/outing";

export interface PickerMemberDTO {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  /** Nom du bateau si le membre est actuellement sur l'eau */
  busyOn?: string | null;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Sélection multiple des membres de l'équipage avec recherche par nom.
 * Gère les rôles rameur / barreur et la capacité du bateau.
 */
export function CrewPicker({
  members,
  value,
  onChange,
  rowingCapacity,
  coxswainCapacity,
  currentUserId,
  invalid,
}: {
  members: PickerMemberDTO[];
  value: CrewMemberInput[];
  onChange: (v: CrewMemberInput[]) => void;
  rowingCapacity: number | null;
  coxswainCapacity: number;
  currentUserId?: string;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const rowers = value.filter((c) => c.crewRole === "ROWER").length;
  const coxes = value.filter((c) => c.crewRole === "COXSWAIN").length;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const list = q
      ? members.filter((m) => normalize(`${m.firstName} ${m.lastName}`).includes(q) || normalize(`${m.lastName} ${m.firstName}`).includes(q))
      : members;
    // L'utilisateur courant en premier, puis ordre alphabétique
    return [...list].sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0));
  }, [members, query, currentUserId]);

  function toggle(id: string) {
    setHint(null);
    if (value.some((c) => c.userId === id)) {
      onChange(value.filter((c) => c.userId !== id));
      return;
    }
    if (rowingCapacity == null || rowers < rowingCapacity) {
      onChange([...value, { userId: id, crewRole: "ROWER" }]);
    } else if (coxes < coxswainCapacity) {
      onChange([...value, { userId: id, crewRole: "COXSWAIN" }]);
    } else {
      setHint(`Le bateau est complet (${rowingCapacity} rameur${rowingCapacity! > 1 ? "s" : ""}${coxswainCapacity ? " + barreur" : ""}).`);
      return;
    }
    setQuery("");
  }

  function setRole(id: string, role: "ROWER" | "COXSWAIN") {
    setHint(null);
    if (role === "COXSWAIN" && coxes >= coxswainCapacity) {
      setHint(coxswainCapacity === 0 ? "Ce bateau n'a pas de place de barreur." : "Il y a déjà un barreur.");
      return;
    }
    if (role === "ROWER" && rowingCapacity != null && rowers >= rowingCapacity) {
      setHint("Toutes les places de rameur sont prises.");
      return;
    }
    onChange(value.map((c) => (c.userId === id ? { ...c, crewRole: role } : c)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {rowingCapacity != null ? (
            <>
              <strong className="text-foreground tabular">
                {rowers}/{rowingCapacity}
              </strong>{" "}
              rameur{rowingCapacity > 1 ? "s" : ""}
              {coxswainCapacity > 0 && (
                <>
                  {" · "}
                  <strong className="text-foreground tabular">
                    {coxes}/{coxswainCapacity}
                  </strong>{" "}
                  barreur
                </>
              )}
            </>
          ) : (
            "Choisissez d'abord un bateau"
          )}
        </span>
      </div>

      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Équipage sélectionné">
          {value.map((c) => {
            const m = byId.get(c.userId);
            if (!m) return null;
            return (
              <li key={c.userId} className="bg-secondary/60 flex items-center gap-2 rounded-lg py-1.5 pr-1.5 pl-2">
                <span className="bg-navy text-navy-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                  {initials(m.firstName, m.lastName)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {m.firstName} {m.lastName}
                  {m.id === currentUserId && <span className="text-muted-foreground font-normal"> (moi)</span>}
                </span>
                {coxswainCapacity > 0 && (
                  <div className="bg-background flex rounded-md border p-0.5 text-xs">
                    {(["ROWER", "COXSWAIN"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(c.userId, r)}
                        className={cn(
                          "rounded px-2 py-1",
                          c.crewRole === r ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        {r === "ROWER" ? "Rameur" : "Barreur"}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggle(c.userId)}
                  className="text-muted-foreground hover:bg-background hover:text-foreground rounded-md p-1.5"
                  aria-label={`Retirer ${m.firstName}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hint && <p className="text-warning text-sm font-medium">{hint}</p>}

      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un membre par nom…"
          className="pl-9"
          aria-invalid={invalid || undefined}
          aria-label="Rechercher un membre"
        />
      </div>
      <ul className="max-h-72 overflow-y-auto rounded-lg border" role="listbox" aria-multiselectable="true">
        {filtered.length === 0 && <li className="text-muted-foreground p-4 text-center text-sm">Aucun membre trouvé</li>}
        {filtered.map((m) => {
          const selected = value.some((c) => c.userId === m.id);
          return (
            <li key={m.id} className="border-b last:border-0">
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggle(m.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                  selected ? "bg-accent/70" : "hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border",
                    selected ? "bg-primary border-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {selected && <Check className="size-3.5" />}
                </span>
                <span className="flex-1">
                  {m.firstName} {m.lastName}
                  {m.id === currentUserId && <span className="text-muted-foreground"> (moi)</span>}
                  {!m.isActive && <span className="text-muted-foreground"> · ancien membre</span>}
                </span>
                {m.busyOn && <span className="text-live text-xs">sur l&apos;eau ({m.busyOn})</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
