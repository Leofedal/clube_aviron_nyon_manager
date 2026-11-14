"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Ban, MoreHorizontal, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setMaintenanceAction } from "@/app/actions/boats";

export function MaintenanceMenu({ boatId, current }: { boatId: string; current: "AVAILABLE" | "MAINTENANCE" | "UNAVAILABLE" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const set = (s: typeof current) =>
    startTransition(async () => {
      const res = await setMaintenanceAction(boatId, s);
      if (res.ok) {
        toast.success("État du bateau mis à jour.");
        router.refresh();
      } else toast.error(res.error);
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} aria-label="Changer l'état">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-muted-foreground text-xs">État du bateau</DropdownMenuLabel>
        <DropdownMenuItem disabled={current === "AVAILABLE"} onClick={() => set("AVAILABLE")}>
          <CheckCircle2 /> Remettre en service
        </DropdownMenuItem>
        <DropdownMenuItem disabled={current === "MAINTENANCE"} onClick={() => set("MAINTENANCE")}>
          <Wrench /> Mettre en maintenance
        </DropdownMenuItem>
        <DropdownMenuItem disabled={current === "UNAVAILABLE"} onClick={() => set("UNAVAILABLE")}>
          <Ban /> Rendre indisponible
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
