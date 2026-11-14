import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`;
}

const kmFmt = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat("fr-CH");

/** "1 234,5" — lisible pour les distances */
export function formatKm(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  return kmFmt.format(Number(n));
}

export function formatInt(n: number): string {
  return intFmt.format(n);
}
