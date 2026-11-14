"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const MAX_TAGS = 5;

/** Saisie d'étiquettes : texte libre + suggestions issues des autres bateaux. */
export function TagInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/\s+/g, " ");
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase()) || value.length >= MAX_TAGS) return;
    onChange([...value, t.slice(0, 60)]);
    setDraft("");
  };
  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span key={t} className="bg-warning/15 inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-sm">
              {t}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== t))}
                className="hover:bg-background rounded p-0.5"
                aria-label={`Retirer l'étiquette ${t}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="ex. Compétiteurs ou chevronnés seulement"
          maxLength={60}
          disabled={value.length >= MAX_TAGS}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => add(draft)} aria-label="Ajouter l'étiquette">
          <Plus />
        </Button>
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Déjà utilisées :</span>
          {unused.slice(0, 8).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="hover:bg-accent rounded-md border px-2 py-0.5">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
