"use client";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="text-muted-foreground text-sm">Veuillez réessayer. Si le problème persiste, contactez un administrateur.</p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
