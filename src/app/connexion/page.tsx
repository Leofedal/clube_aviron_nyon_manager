import { redirect } from "next/navigation";
import { CLUB } from "@/lib/club";
import { ClubLogo } from "@/components/layout/club-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { suite } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-secondary/60 to-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <ClubLogo className="h-24 rounded-2xl p-3 shadow-sm" priority />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{CLUB.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">Registre des sorties</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <LoginForm next={suite} />
        </div>
        <p className="text-muted-foreground mt-6 text-center text-xs">
          Mot de passe oublié ? Demandez à un administrateur du club de le réinitialiser.
        </p>
      </div>
    </main>
  );
}
