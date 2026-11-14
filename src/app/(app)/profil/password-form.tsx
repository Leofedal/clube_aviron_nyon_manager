"use client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/app/actions/auth";
import { passwordChangeSchema } from "@/lib/validation/admin";

type Values = z.infer<typeof passwordChangeSchema>;

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState, setError, reset } = useForm<Values>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const onSubmit = handleSubmit((data) =>
    startTransition(async () => {
      const res = await changePasswordAction(data);
      if (res.ok) {
        toast.success("Mot de passe modifié.");
        reset();
      } else setError("root", { message: res.error });
    }),
  );
  const err = formState.errors;
  return (
    <form onSubmit={onSubmit} className="bg-card grid gap-4 rounded-xl border p-5" noValidate>
      <h2 className="font-semibold">Changer mon mot de passe</h2>
      <div className="grid gap-2">
        <Label htmlFor="currentPassword">Mot de passe actuel</Label>
        <Input id="currentPassword" type="password" autoComplete="current-password" {...register("currentPassword")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <Input id="newPassword" type="password" autoComplete="new-password" {...register("newPassword")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Confirmation</Label>
        <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />
      </div>
      {(err.currentPassword || err.newPassword || err.confirm || err.root) && (
        <p className="text-destructive text-sm">
          {err.currentPassword?.message ?? err.newPassword?.message ?? err.confirm?.message ?? err.root?.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Enregistrer
      </Button>
    </form>
  );
}
