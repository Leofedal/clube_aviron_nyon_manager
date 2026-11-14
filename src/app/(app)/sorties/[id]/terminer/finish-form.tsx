"use client";
import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { finishOutingAction } from "@/app/actions/outings";
import { finishOutingSchema, type FinishOutingData, type FinishOutingInput } from "@/lib/validation/outing";
import { CLUB_TZ, formatDuration, formatTime } from "@/lib/time";
import { crewNames, type OutingDTO } from "@/lib/dto";
import { DirectionLabel } from "@/components/outings/direction-label";
import { cn } from "@/lib/utils";

const QUICK_KM = [6, 8, 10, 12, 15, 20];

export function FinishOutingForm({ outing, defaults }: { outing: OutingDTO; defaults: { date: string; time: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<FinishOutingInput, unknown, FinishOutingData>({
    resolver: zodResolver(finishOutingSchema),
    defaultValues: { returnDate: defaults.date, returnTime: defaults.time, distanceKm: "", notes: outing.notes ?? "" },
  });
  const { register, handleSubmit, watch, setValue, setError, formState } = form;

  // Heure de retour actualisée à l'ouverture côté client
  useEffect(() => {
    const now = new Date();
    if (!formState.dirtyFields.returnTime) {
      setValue("returnDate", formatInTimeZone(now, CLUB_TZ, "yyyy-MM-dd"));
      setValue("returnTime", formatInTimeZone(now, CLUB_TZ, "HH:mm"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rd, rt, km] = watch(["returnDate", "returnTime", "distanceKm"]);
  const duration = useMemo(() => {
    try {
      const ret = fromZonedTime(`${rd}T${rt}:00`, CLUB_TZ);
      return Math.floor((ret.getTime() - new Date(outing.departureAt).getTime()) / 60000);
    } catch {
      return null;
    }
  }, [rd, rt, outing.departureAt]);

  const onSubmit = handleSubmit((data) =>
    startTransition(async () => {
      const res = await finishOutingAction(outing.id, data);
      if (res.ok) {
        toast.success("Sortie terminée. Le bateau est de nouveau disponible.");
        router.push(`/sorties/${outing.id}`);
      } else {
        toast.error(res.error);
        setError("root", { message: res.error });
        if (res.code === "ALREADY_FINISHED") router.push(`/sorties/${outing.id}`);
      }
    }),
  );

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Terminer la sortie</h1>
      <p className="text-muted-foreground mb-5 text-sm">Bon retour ! Indiquez l&apos;heure de retour et la distance parcourue.</p>

      <Card className="mb-5">
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bateau</span>
            <span className="font-medium">{outing.boatName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Équipage</span>
            <span className="text-right font-medium">{crewNames(outing.crew)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Direction</span>
            <DirectionLabel direction={outing.direction} className="font-medium" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Départ</span>
            <span className="font-medium">{formatTime(new Date(outing.departureAt))}</span>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="returnDate">Date de retour</Label>
            <Input id="returnDate" type="date" {...register("returnDate")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="returnTime">Heure de retour</Label>
            <Input id="returnTime" type="time" {...register("returnTime")} aria-invalid={!!formState.errors.returnTime} />
          </div>
        </div>
        <p className={cn("-mt-2 text-sm", duration != null && duration <= 0 ? "text-destructive" : "text-muted-foreground")}>
          Durée : <strong className="text-foreground">{duration != null && duration > 0 ? formatDuration(duration) : "retour antérieur au départ"}</strong>
        </p>

        <div className="grid gap-2">
          <Label htmlFor="distanceKm">Distance parcourue (km)</Label>
          <Input
            id="distanceKm"
            inputMode="decimal"
            placeholder="ex. 12,5"
            className="h-14 text-2xl font-semibold tabular md:text-2xl"
            autoFocus
            {...register("distanceKm")}
            aria-invalid={!!formState.errors.distanceKm}
          />
          <div className="flex flex-wrap gap-2">
            {QUICK_KM.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setValue("distanceKm", String(k), { shouldValidate: true })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm tabular transition-colors",
                  String(km) === String(k) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
                )}
              >
                {k} km
              </button>
            ))}
          </div>
          {formState.errors.distanceKm && <p className="text-destructive text-sm">{formState.errors.distanceKm.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">
            Commentaire <span className="text-muted-foreground font-normal">(facultatif)</span>
          </Label>
          <Textarea id="notes" placeholder="Conditions, matériel, remarques…" {...register("notes")} />
        </div>

        {formState.errors.root && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {formState.errors.root.message}
          </p>
        )}
        <Button type="submit" size="xl" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Flag />}
          Terminer la sortie
        </Button>
      </form>
    </div>
  );
}
