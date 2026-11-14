/**
 * Règles de permissions — fonctions pures, appelées côté serveur
 * (services métier) et réutilisées côté interface pour afficher/masquer les actions.
 */
import type { OutingStatus, Role } from "@prisma/client";

export interface Actor {
  id: string;
  role: Role;
}

export interface OutingAccessInfo {
  status: OutingStatus;
  createdById: string;
  departureAt: Date;
  createdAt: Date;
  crewUserIds: string[];
}

/** Un membre peut modifier ses propres sorties pendant ce délai après le départ. */
export const MEMBER_EDIT_WINDOW_DAYS = 7;
/** Un membre peut annuler une sortie en cours qu'il a créée par erreur pendant ce délai. */
export const MEMBER_CANCEL_WINDOW_MINUTES = 30;

export const isAdmin = (a: Actor) => a.role === "ADMIN";

export function isParticipant(actor: Actor, o: OutingAccessInfo): boolean {
  return o.createdById === actor.id || o.crewUserIds.includes(actor.id);
}

/** Terminer : administrateur, ou membre de l'équipage / auteur de la saisie. */
export function canFinishOuting(actor: Actor, o: OutingAccessInfo): boolean {
  if (o.status !== "IN_PROGRESS") return false;
  return isAdmin(actor) || isParticipant(actor, o);
}

/** Modifier : administrateur sans limite ; membre sur ses sorties des 7 derniers jours. Jamais une sortie annulée. */
export function canEditOuting(actor: Actor, o: OutingAccessInfo, now: Date = new Date()): boolean {
  if (o.status === "CANCELLED") return false; // l'annulation est définitive (et tracée)
  if (isAdmin(actor)) return true;
  if (!isParticipant(actor, o)) return false;
  const limit = o.departureAt.getTime() + MEMBER_EDIT_WINDOW_DAYS * 24 * 3600 * 1000;
  return now.getTime() <= limit;
}

/** Annuler : administrateur ; ou auteur d'une sortie en cours créée il y a moins de 30 min. */
export function canCancelOuting(actor: Actor, o: OutingAccessInfo, now: Date = new Date()): boolean {
  if (o.status === "CANCELLED") return false;
  if (isAdmin(actor)) return true;
  return (
    o.status === "IN_PROGRESS" &&
    o.createdById === actor.id &&
    now.getTime() - o.createdAt.getTime() <= MEMBER_CANCEL_WINDOW_MINUTES * 60 * 1000
  );
}

export const canManageMembers = isAdmin;
export const canManageBoats = isAdmin;
export const canExport = isAdmin;
export const canViewAudit = isAdmin;
/** Seuls les administrateurs peuvent forcer un chevauchement (correction tracée). */
export const canOverrideOverlap = isAdmin;
/** Seuls les administrateurs peuvent inclure des membres désactivés (saisie d'archives). */
export const canUseInactiveMembers = isAdmin;
