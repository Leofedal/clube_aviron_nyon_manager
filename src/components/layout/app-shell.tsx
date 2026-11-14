"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Menu, Play, Plus } from "lucide-react";
import { CLUB } from "@/lib/club";
import { ClubLogo } from "./club-logo";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import { NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function AppShell({
  user,
  activeCount,
  children,
}: {
  user: SessionUser;
  activeCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !("adminOnly" in i) || user.role === "ADMIN");
  const [moreOpen, setMoreOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* Sidebar (ordinateur / tablette) */}
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-dvh flex-col border-r md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-4 py-4">
          <ClubLogo className="h-10" priority />
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold">{CLUB.name}</span>
            <span className="text-muted-foreground block text-xs">{CLUB.appName}</span>
          </span>
        </Link>
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          <Button asChild size="sm" className="justify-start">
            <Link href="/sorties/demarrer">
              <Play /> Démarrer une sortie
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="justify-start">
            <Link href="/sorties/ajouter">
              <CalendarPlus /> Ajouter une sortie passée
            </Link>
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Navigation principale">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <item.icon className="size-4 opacity-80" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/" && activeCount > 0 && (
                  <span
                    className="bg-live/15 text-live rounded px-1.5 text-[11px] font-semibold tabular"
                    title={`${activeCount} bateau(x) sur l'eau`}
                  >
                    {activeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-sidebar-border flex items-center justify-between border-t px-3 py-2">
          <UserMenu user={user} />
          <span className="text-muted-foreground flex-1 truncate px-2 text-xs">
            {user.firstName} {user.role === "ADMIN" && "· Admin"}
          </span>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Barre supérieure mobile */}
        <header className="bg-background/85 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <ClubLogo className="h-9" priority />
            <span className="text-sm font-semibold">{CLUB.name}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">{children}</main>
      </div>

      {/* Navigation inférieure mobile */}
      <nav
        className="bg-background/95 fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Navigation mobile"
      >
        {[items[0], items[1]].map((item) => (
          <MobileLink key={item.href} href={item.href} label={item.short} icon={item.icon} active={isActive(pathname, item.href)} />
        ))}
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="flex flex-col items-center justify-center"
          aria-label="Nouvelle sortie"
        >
          <span className="bg-primary text-primary-foreground -mt-5 flex size-13 items-center justify-center rounded-full shadow-lg ring-4 ring-background">
            <Plus className="size-6" />
          </span>
        </button>
        <MobileLink href="/statistiques" label="Stats" icon={items.find((i) => i.href === "/statistiques")!.icon} active={isActive(pathname, "/statistiques")} />
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="text-muted-foreground flex flex-col items-center justify-center gap-0.5 py-2 text-[11px]"
        >
          <Menu className="size-5" />
          Plus
        </button>
      </nav>

      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent side="bottom" className="pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle>Nouvelle sortie</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 px-4">
            <Button asChild size="xl" onClick={() => setNewOpen(false)}>
              <Link href="/sorties/demarrer">
                <Play /> Démarrer une sortie
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" onClick={() => setNewOpen(false)}>
              <Link href="/sorties/ajouter">
                <CalendarPlus /> Ajouter une sortie passée
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 px-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-base",
                  isActive(pathname, item.href) ? "bg-accent font-medium" : "hover:bg-accent/60",
                )}
              >
                <item.icon className="size-5 opacity-80" />
                {item.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MobileLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px]",
        active ? "text-primary font-medium" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
