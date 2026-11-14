"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resetPasswordAction, saveMemberAction } from "@/app/actions/members";
import { memberSchema, type MemberInput } from "@/lib/validation/admin";

function TempPassword({ value }: { value: string }) {
  return (
    <div className="bg-secondary/60 rounded-lg border p-3 text-sm">
      <p className="mb-2 font-medium">Mot de passe temporaire</p>
      <div className="flex items-center gap-2">
        <code className="bg-background flex-1 rounded px-2 py-1.5 font-mono text-base">{value}</code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copier"
          onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success("Copié"))}
        >
          <Copy />
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Transmettez-le au membre de façon sécurisée. Il ne sera plus affiché ; le membre pourra le changer depuis son profil.
      </p>
    </div>
  );
}

export function MemberFormDialog({
  member,
  trigger,
}: {
  member?: { id: string } & MemberInput;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<MemberInput>({
    resolver: zodResolver(memberSchema),
    defaultValues: member ?? { firstName: "", lastName: "", email: "", role: "MEMBER", isActive: true },
  });
  const { register, control, handleSubmit, formState, setError, reset } = form;

  const onSubmit = handleSubmit((data) =>
    startTransition(async () => {
      const res = await saveMemberAction(member?.id ?? null, data);
      if (res.ok) {
        toast.success(member ? "Membre mis à jour." : "Membre ajouté.");
        router.refresh();
        if (res.data.temporaryPassword) setTempPassword(res.data.temporaryPassword);
        else setOpen(false);
      } else setError("root", { message: res.error });
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setTempPassword(null);
          if (!member) reset();
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Modifier le membre" : "Ajouter un membre"}</DialogTitle>
          <DialogDescription>
            {member
              ? "Un membre désactivé ne peut plus se connecter, mais son historique de sorties est conservé."
              : "Un mot de passe temporaire sera généré."}
          </DialogDescription>
        </DialogHeader>
        {tempPassword ? (
          <>
            <TempPassword value={tempPassword} />
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Terminé</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" {...register("firstName")} aria-invalid={!!formState.errors.firstName} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" {...register("lastName")} aria-invalid={!!formState.errors.lastName} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail (identifiant de connexion)</Label>
              <Input id="email" type="email" {...register("email")} aria-invalid={!!formState.errors.email} />
            </div>
            {Object.values(formState.errors).some((e) => e && "message" in e && e !== formState.errors.root) && (
              <p className="text-destructive text-sm">
                {formState.errors.firstName?.message ?? formState.errors.lastName?.message ?? formState.errors.email?.message}
              </p>
            )}
            <div className="grid grid-cols-2 items-end gap-3">
              <div className="grid gap-2">
                <Label>Rôle</Label>
                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Membre</SelectItem>
                        <SelectItem value="ADMIN">Administrateur</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <label className="flex h-10 items-center gap-2 text-sm">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    {field.value ? "Actif" : "Inactif"}
                  </label>
                )}
              />
            </div>
            {formState.errors.root && (
              <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{formState.errors.root.message}</p>
            )}
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
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ResetPasswordButton({ memberId, name }: { memberId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTemp(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound /> Réinitialiser le mot de passe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe de {name} ?</DialogTitle>
          <DialogDescription>Ses sessions ouvertes seront déconnectées. L&apos;opération est tracée.</DialogDescription>
        </DialogHeader>
        {temp ? (
          <TempPassword value={temp} />
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await resetPasswordAction(memberId);
                  if (res.ok) setTemp(res.data.temporaryPassword);
                  else toast.error(res.error);
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
