import { requireUser } from "@/lib/auth/session";
import { countBoatsOnWater } from "@/lib/services/stats";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const activeCount = await countBoatsOnWater();
  return (
    <AppShell user={user} activeCount={activeCount}>
      {children}
    </AppShell>
  );
}
