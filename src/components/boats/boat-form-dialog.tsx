"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveBoatAction } from "@/app/actions/boats";
import { TagInput } from "./tag-input";
import { boatSchema, type BoatData, type BoatInput } from "@/lib/validation/admin";

export interface BoatTypeDTO {
  id: string;
  code: string;
  label: string;
  defaultRowingCapacity: number;
  defaultCoxswainCapacity: number;
}

export function BoatFormDialog({
  boat,
  types,
  trigger,
  tagSuggestions = [],
}: {
  boat?: { id: string } & BoatInput;
  types: BoatTypeDTO[];
  trigger: React.ReactNode;
  tagSuggestions?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<BoatInput, unknown, BoatData>({
    resolver: zodResolver(boatSchema),
    defaultValues: boat ?? {
      name: "",
      boatTypeId: "",
      rowingCapacity: 1,
      coxswainCapacity: 0,
      maintenanceStatus: "AVAILABLE",
      notes: "",
      tags: [],
    },
  });
  const { register, control, handleSubmit, setValue, formState, setError, reset } = form;

  const onSubmit = handleSubmit((data) =>
    startTransition(async () => {
      const res = await saveBoatAction(boat?.id ?? null, { ...data, notes: data.notes ?? "" });
      if (res.ok) {
        toast.success(boat ? "Bateau mis à jour." : "Bateau ajouté.");
        setOpen(false);
        if (!boat) reset();
        router.refresh();
      } else setError("root", { message: res.error });
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{boat ? "Modifier le bateau" : "Ajouter un bateau"}</DialogTitle>
          <DialogDescription>La disponibilité « Sur l&apos;eau » est calculée automatiquement à partir des sorties.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" {...register("name")} aria-invalid={!!formState.errors.name} />
            {formState.errors.name && <p className="text-destructive text-sm">{formState.errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Controller
              control={control}
              name="boatTypeId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    const t = types.find((x) => x.id === v);
                    if (t && !boat) {
                      setValue("rowingCapacity", t.defaultRowingCapacity);
                      setValue("coxswainCapacity", t.defaultCoxswainCapacity);
                    }
                  }}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!formState.errors.boatTypeId}>
                    <SelectValue placeholder="Choisir un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label} {t.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {formState.errors.boatTypeId && <p className="text-destructive text-sm">{formState.errors.boatTypeId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="rowingCapacity">Rameurs</Label>
              <Input id="rowingCapacity" type="number" min={1} max={8} {...register("rowingCapacity")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="coxswainCapacity">Barreurs</Label>
              <Input id="coxswainCapacity" type="number" min={0} max={1} {...register("coxswainCapacity")} />
            </div>
          </div>
          {(formState.errors.rowingCapacity || formState.errors.coxswainCapacity) && (
            <p className="text-destructive text-sm">
              {formState.errors.rowingCapacity?.message ?? formState.errors.coxswainCapacity?.message}
            </p>
          )}
          <div className="grid gap-2">
            <Label>État</Label>
            <Controller
              control={control}
              name="maintenanceStatus"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">En service</SelectItem>
                    <SelectItem value="MAINTENANCE">En maintenance</SelectItem>
                    <SelectItem value="UNAVAILABLE">Indisponible</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label>Étiquettes d&apos;avertissement</Label>
            <Controller
              control={control}
              name="tags"
              render={({ field }) => (
                <TagInput value={field.value ?? []} onChange={field.onChange} suggestions={tagSuggestions} />
              )}
            />
            <p className="text-muted-foreground text-xs">
              Affichées en avertissement quand un membre choisit ce bateau. Elles ne bloquent pas la sortie.
            </p>
            {formState.errors.tags && <p className="text-destructive text-sm">{formState.errors.tags.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Réglages, réparations, consignes…" />
          </div>
          {formState.errors.root && <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{formState.errors.root.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
