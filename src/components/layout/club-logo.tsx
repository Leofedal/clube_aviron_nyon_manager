import Image from "next/image";
import { CLUB } from "@/lib/club";
import { cn } from "@/lib/utils";

/**
 * Logo du club sur une pastille blanche : les avirons noirs du logo
 * restent ainsi lisibles en mode sombre.
 */
export function ClubLogo({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-black/5", className)}>
      <Image
        src={CLUB.logo}
        alt={`Logo du ${CLUB.name}`}
        width={CLUB.logoWidth}
        height={CLUB.logoHeight}
        priority={priority}
        className="h-full w-auto object-contain"
      />
    </span>
  );
}
