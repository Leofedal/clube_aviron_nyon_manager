import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Étiquettes d'avertissement d'un bateau (ex. « Compétiteurs ou chevronnés seulement »). */
export function BoatTags({ tags, className }: { tags: string[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((t) => (
        <span
          key={t}
          className="bg-warning/15 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-[color-mix(in_oklch,var(--warning)_60%,black)] dark:text-warning"
        >
          <TriangleAlert className="size-3 shrink-0" />
          {t}
        </span>
      ))}
    </span>
  );
}

/** Encadré d'avertissement affiché quand un bateau étiqueté est choisi. */
export function BoatTagsWarning({ boatName, tags }: { boatName: string; tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div role="note" className="border-warning/50 bg-warning/10 flex items-start gap-2.5 rounded-xl border p-3.5 text-sm">
      <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">
          {boatName} : {tags.join(" · ")}
        </p>
        <p className="text-muted-foreground">Vérifiez que l&apos;équipage respecte cette consigne avant de partir.</p>
      </div>
    </div>
  );
}
