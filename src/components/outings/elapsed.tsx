"use client";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/time";

/** Durée écoulée depuis le départ, mise à jour chaque minute. */
export function Elapsed({ since, className }: { since: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000));
  return (
    <span className={className} suppressHydrationWarning>
      {formatDuration(minutes)}
    </span>
  );
}
