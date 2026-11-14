/** Erreur métier avec message destiné à l'utilisateur (en français). */
export class DomainError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "UNAUTHENTICATED"
      | "VALIDATION"
      | "BOAT_UNAVAILABLE"
      | "BOAT_BUSY"
      | "OVERLAP"
      | "CREW_BUSY"
      | "CAPACITY"
      | "ALREADY_FINISHED"
      | "CONFLICT",
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/**
 * Traduit les violations de contraintes PostgreSQL (concurrence) en erreurs métier.
 * Les contraintes sont définies dans la migration initiale.
 */
export function mapDatabaseError(e: unknown): DomainError | null {
  const text = (() => {
    try {
      const err = e as { message?: string; meta?: unknown; code?: string };
      return `${err.code ?? ""} ${err.message ?? ""} ${JSON.stringify(err.meta ?? {})}`;
    } catch {
      return String(e);
    }
  })();
  const err = e as { code?: string; meta?: { target?: unknown; modelName?: string } };
  const isActiveBoatIndex =
    err?.code === "P2002" &&
    (err.meta?.modelName === "Outing" || text.includes("Outing")) &&
    JSON.stringify(err.meta?.target ?? "").includes("boatId");
  if (text.includes("Outing_one_active_per_boat") || isActiveBoatIndex) {
    return new DomainError("BOAT_BUSY", "Ce bateau vient d'être pris par un autre équipage. Choisissez un autre bateau.");
  }
  if (text.includes("Outing_no_boat_overlap") || text.includes("23P01")) {
    return new DomainError(
      "OVERLAP",
      "Ce bateau est déjà enregistré sur une sortie qui chevauche cette période.",
    );
  }
  if (text.includes("Outing_return_after_departure")) {
    return new DomainError("VALIDATION", "L'heure de retour doit être postérieure à l'heure de départ.");
  }
  if (text.includes("Outing_distance_non_negative")) {
    return new DomainError("VALIDATION", "La distance ne peut pas être négative.");
  }
  return null;
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string>; details?: Record<string, unknown> };

/** Convertit n'importe quelle erreur en résultat d'action sérialisable. */
export function toActionError(e: unknown): Extract<ActionResult, { ok: false }> {
  if (e instanceof DomainError) return { ok: false, error: e.message, code: e.code, details: e.details };
  const mapped = mapDatabaseError(e);
  if (mapped) return { ok: false, error: mapped.message, code: mapped.code };
  console.error(e);
  return { ok: false, error: "Une erreur inattendue est survenue. Veuillez réessayer." };
}
