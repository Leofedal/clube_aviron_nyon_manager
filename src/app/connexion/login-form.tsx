"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/app/actions/auth";

export interface DemoAccount {
  label: string;
  who: string;
  email: string;
  password: string;
}

export function LoginForm({ next, demoAccounts = [] }: { next?: string; demoAccounts?: DemoAccount[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const login = (email: string, password: string) => {
    setError(null);
    startTransition(async () => {
      const res = await loginAction({ email, password, next });
      if (res && !res.ok) setError(res.error);
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus inputMode="email" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Se connecter
      </Button>
      {demoAccounts.length > 0 && (
        <div className="border-t pt-4">
          <p className="text-muted-foreground mb-2 text-xs font-medium">Comptes de démonstration</p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((a) => (
              <Button
                key={a.email}
                type="button"
                variant="outline"
                className="h-auto flex-col items-start gap-0 py-2"
                disabled={pending}
                onClick={() => login(a.email, a.password)}
              >
                <span className="font-semibold">{a.label}</span>
                <span className="text-muted-foreground text-xs font-normal">{a.who}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
