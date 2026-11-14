"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBoatTypeAction } from "@/app/actions/boats";

export function BoatTypeDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> Type de bateau
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau type de bateau</DialogTitle>
          <DialogDescription>Ex. « 2+ — Deux avec barreur » ou « C4x — Yole de mer ».</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await createBoatTypeAction({
                code: String(fd.get("code")),
                label: String(fd.get("label")),
                defaultRowingCapacity: Number(fd.get("rowers")),
                defaultCoxswainCapacity: Number(fd.get("cox")),
              });
              if (res.ok) {
                toast.success("Type ajouté.");
                setOpen(false);
                router.refresh();
              } else setError(res.error);
            });
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" required placeholder="2+" />
            </div>
            <div className="col-span-2 grid gap-2">
              <Label htmlFor="label">Libellé</Label>
              <Input id="label" name="label" required placeholder="Deux avec barreur" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="rowers">Rameurs</Label>
              <Input id="rowers" name="rowers" type="number" min={1} max={8} defaultValue={2} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cox">Barreurs</Label>
              <Input id="cox" name="cox" type="number" min={0} max={1} defaultValue={0} />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
