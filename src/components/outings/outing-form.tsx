"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, MoonStar, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrewPicker, type PickerMemberDTO } from "@/components/outings/crew-picker";
import { BoatTagsWarning } from "@/components/boats/boat-tags";
import { DirectionPicker } from "@/components/outings/direction-picker";
import { createRetrospectiveOutingAction, updateOutingAction } from "@/app/actions/outings";
import { updateOutingSchema, type UpdateOutingData, type UpdateOutingInput } from "@/lib/validation/outing";
import { formatDuration } from "@/lib/time";
import type { BoatOptionDTO } from "@/lib/picker-data";

type Mode = { kind: "create" } | { kind: "edit"; outingId: string; status: "IN_PROGRESS" | "COMPLETED" };

function minutesBetween(dep?: string, ret?: string) {
  if (!dep || !ret || !/^\d{2}:\d{2}$/.test(dep) || !/^\d{2}:\d{2}$/.test(ret)) return null;
  const [h1, m1] = dep.split(":").map(Number);
  const [h2, m2] = ret.split(":").map(Number);
  let d = h2 * 60 + m2 - (h1 * 60 + m1);
  if (d <= 0) d += 24 * 60;
  return d;
}

export function OutingForm({
  mode,
  boats,
  members,
  currentUserId,
  isAdmin,
  defaults,
}: {
  mode: Mode;
  boats: BoatOptionDTO[];
  members: PickerMemberDTO[];
  currentUserId: string;
  isAdmin: boolean;
  /** La direction peut être vide à la création : le membre doit la choisir. */
  defaults: Omit<UpdateOutingInput, "direction"> & { direction?: UpdateOutingInput["direction"] | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [conflict, setConflict] = useState<{ message: string; canOverride: boolean } | null>(null);
  const live = mode.kind === "edit" && mode.status === "IN_PROGRESS";

  const form = useForm<UpdateOutingInput, unknown, UpdateOutingData>({
    resolver: zodResolver(
      live
        ? updateOutingSchema
        : updateOutingSchema.refine((d) => !!d.returnTime, { path: ["returnTime"], message: "Heure de retour requise" }).refine(
            (d) => d.distanceKm !== undefined,
            { path: ["distanceKm"], message: "Indiquez la distance parcourue" },
          ),
    ),
    defaultValues: { ...defaults, direction: defaults.direction ?? undefined } as UpdateOutingInput,
  });
  const { register, control, handleSubmit, watch, formState, setError } = form;
  const [boatId, depRaw, retRaw] = watch(["boatId", "departureTime", "returnTime"]);
  const dep = typeof depRaw === "string" ? depRaw : "";
  const ret = typeof retRaw === "string" ? retRaw : "";
  const boat = useMemo(() => boats.find((b) => b.id === boatId) ?? null, [boats, boatId]);
  const duration = live ? null : minutesBetween(dep, ret);
  const crossesMidnight = !live && !!dep && !!ret && ret <= dep;

  const submit = (allowOverlap: boolean) =>
    handleSubmit((data) =>
      startTransition(async () => {
        setConflict(null);
        const payload = { ...data, allowOverlap };
        const res =
          mode.kind === "create"
            ? await createRetrospectiveOutingAction({
                ...payload,
                returnTime: data.returnTime!,
                distanceKm: data.distanceKm!,
              })
            : await updateOutingAction(mode.outingId, payload);
        if (res.ok) {
          toast.success(mode.kind === "create" ? "Sortie enregistrée." : "Sortie mise à jour.");
          router.push(`/sorties/${res.data.id}`);
          router.refresh();
        } else {
          const canOverride = Boolean((res.details as { canOverride?: boolean } | undefined)?.canOverride);
          if (res.code === "OVERLAP" || res.code === "CREW_BUSY") setConflict({ message: res.error, canOverride });
          else setError("root", { message: res.error });
          toast.error(res.error);
        }
      }),
    );

  const boatGroups = [
    { label: "Disponibles", items: boats.filter((b) => b.availability === "AVAILABLE" || b.id === defaults.boatId) },
    { label: "Sur l'eau / en maintenance", items: boats.filter((b) => b.availability !== "AVAILABLE" && b.id !== defaults.boatId) },
  ].filter((g) => g.items.length);

  return (
    <form onSubmit={submit(false)} className="flex flex-col gap-6" noValidate>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="date">{live ? "Date de départ" : "Date de la sortie"}</Label>
          <Input id="date" type="date" {...register("date")} aria-invalid={!!formState.errors.date} />
          {formState.errors.date && <p className="text-destructive text-sm">{formState.errors.date.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label>Bateau</Label>
          <Controller
            control={control}
            name="boatId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full" aria-invalid={!!formState.errors.boatId}>
                  <SelectValue placeholder="Choisir un bateau" />
                </SelectTrigger>
                <SelectContent>
                  {boatGroups.map((g) => (
                    <SelectGroup key={g.label}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.items.map((b) => (
                        <SelectItem key={b.id} value={b.id} disabled={live && b.availability !== "AVAILABLE" && b.id !== defaults.boatId}>
                          {b.name} · {b.typeCode}
                          {b.tags.length > 0 && " ⚠"}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {formState.errors.boatId && <p className="text-destructive text-sm">{formState.errors.boatId.message}</p>}
        </div>
      </section>

      {boat && <BoatTagsWarning boatName={boat.name} tags={boat.tags} />}

      <section className="grid gap-2">
        <Label>Direction</Label>
        <Controller
          control={control}
          name="direction"
          render={({ field }) => (
            <DirectionPicker value={field.value} onChange={field.onChange} invalid={!!formState.errors.direction} />
          )}
        />
        {formState.errors.direction && <p className="text-destructive text-sm">{formState.errors.direction.message}</p>}
      </section>

      <section className="grid gap-2">
        <Label>Équipage</Label>
        <Controller
          control={control}
          name="crew"
          render={({ field }) => (
            <CrewPicker
              members={members}
              value={field.value}
              onChange={field.onChange}
              rowingCapacity={boat?.rowingCapacity ?? null}
              coxswainCapacity={boat?.coxswainCapacity ?? 0}
              currentUserId={currentUserId}
              invalid={!!formState.errors.crew}
            />
          )}
        />
        {formState.errors.crew && (
          <p className="text-destructive text-sm">
            {formState.errors.crew.message ?? formState.errors.crew.root?.message ?? "Équipage invalide"}
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="departureTime">Heure de départ</Label>
          <Input id="departureTime" type="time" {...register("departureTime")} aria-invalid={!!formState.errors.departureTime} />
          {formState.errors.departureTime && <p className="text-destructive text-sm">{formState.errors.departureTime.message}</p>}
        </div>
        {!live && (
          <div className="grid gap-2">
            <Label htmlFor="returnTime">Heure de retour</Label>
            <Input id="returnTime" type="time" {...register("returnTime")} aria-invalid={!!formState.errors.returnTime} />
            {formState.errors.returnTime && <p className="text-destructive text-sm">{formState.errors.returnTime.message}</p>}
          </div>
        )}
        {!live && duration != null && (
          <p className="text-muted-foreground col-span-2 -mt-2 flex items-center gap-1.5 text-sm">
            Durée : <strong className="text-foreground">{formatDuration(duration)}</strong>
            {crossesMidnight && (
              <span className="text-live inline-flex items-center gap-1">
                <MoonStar className="size-3.5" /> retour le lendemain
              </span>
            )}
          </p>
        )}
      </section>

      {!live && (
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="distanceKm">Distance parcourue (km)</Label>
          <Input
            id="distanceKm"
            inputMode="decimal"
            placeholder="ex. 12,5"
            className="text-lg font-semibold tabular"
            {...register("distanceKm")}
            aria-invalid={!!formState.errors.distanceKm}
          />
          {formState.errors.distanceKm && <p className="text-destructive text-sm">{formState.errors.distanceKm.message}</p>}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="notes">
          Commentaire <span className="text-muted-foreground font-normal">(facultatif)</span>
        </Label>
        <Textarea id="notes" {...register("notes")} placeholder="Conditions, parcours, matériel…" />
      </div>

      {mode.kind === "edit" && isAdmin && (
        <div className="grid gap-2">
          <Label htmlFor="reason">
            Motif de la correction <span className="text-muted-foreground font-normal">(journal d&apos;audit)</span>
          </Label>
          <Input id="reason" {...register("reason")} placeholder="Ex. erreur de kilométrage signalée par l'équipage" />
        </div>
      )}

      {conflict && (
        <div role="alert" className="border-warning/50 bg-warning/10 rounded-xl border p-4 text-sm">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" /> {conflict.message}
          </p>
          {conflict.canOverride ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="text-muted-foreground flex-1">
                En tant qu&apos;administrateur, vous pouvez autoriser explicitement ce chevauchement. La correction sera tracée.
              </p>
              <Button type="button" variant="outline" disabled={pending} onClick={submit(true)}>
                Autoriser le chevauchement
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground mt-2">Vérifiez la date et les heures. En cas de doute, contactez un administrateur.</p>
          )}
        </div>
      )}
      {formState.errors.root && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {formState.errors.root.message}
        </p>
      )}

      <Button type="submit" size="xl" disabled={pending} className="sm:self-start">
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {mode.kind === "create" ? "Enregistrer la sortie" : "Enregistrer les modifications"}
      </Button>
    </form>
  );
}
