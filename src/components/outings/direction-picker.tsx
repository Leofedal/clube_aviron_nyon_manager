"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Direction = "GENEVA" | "LAUSANNE";

/** Choix de la direction sur le Léman : Genève (sud-ouest) ou Lausanne (nord-est). */
export function DirectionPicker({
  value,
  onChange,
  invalid,
}: {
  value: Direction | undefined | null;
  onChange: (d: Direction) => void;
  invalid?: boolean;
}) {
  const options: { value: Direction; label: string; icon: typeof ArrowLeft; side: "left" | "right" }[] = [
    { value: "GENEVA", label: "Genève", icon: ArrowLeft, side: "left" },
    { value: "LAUSANNE", label: "Lausanne", icon: ArrowRight, side: "right" },
  ];
  return (
    <div role="radiogroup" aria-label="Direction de la sortie" className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-14 items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent border-input bg-background",
              invalid && !value && "border-destructive/60",
            )}
          >
            {o.side === "left" && <o.icon className="size-5" />}
            {o.label}
            {o.side === "right" && <o.icon className="size-5" />}
          </button>
        );
      })}
    </div>
  );
}
