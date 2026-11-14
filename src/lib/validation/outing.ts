import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const timeStr = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.string({ required_error: "Heure requise" }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (HH:MM)"),
);

export const MAX_DISTANCE_KM = 200;

/** Accepte "12", "12.5" ou "12,5" ; arrondi à 2 décimales. */
export const distanceSchema = z.preprocess(
  (v) => {
    if (typeof v === "number") return v;
    if (typeof v !== "string") return v;
    const t = v.trim().replace(",", ".");
    if (t === "") return undefined;
    return Number(t);
  },
  z
    .number({ required_error: "Indiquez la distance parcourue", invalid_type_error: "Distance invalide" })
    .finite("Distance invalide")
    .min(0, "La distance doit être positive ou nulle")
    .max(MAX_DISTANCE_KM, `La distance ne peut pas dépasser ${MAX_DISTANCE_KM} km`)
    .transform((n) => Math.round(n * 100) / 100),
);

export const DIRECTIONS = ["GENEVA", "LAUSANNE"] as const;
export const DIRECTION_LABELS: Record<(typeof DIRECTIONS)[number], string> = { GENEVA: "Genève", LAUSANNE: "Lausanne" };
export const directionSchema = z.enum(DIRECTIONS, {
  required_error: "Choisissez la direction : Genève ou Lausanne",
  invalid_type_error: "Choisissez la direction : Genève ou Lausanne",
});

export const crewMemberSchema = z.object({
  userId: z.string().min(1),
  crewRole: z.enum(["ROWER", "COXSWAIN"]),
});

export const crewSchema = z
  .array(crewMemberSchema)
  .min(1, "Sélectionnez au moins un rameur")
  .superRefine((crew, ctx) => {
    const ids = new Set<string>();
    for (const m of crew) {
      if (ids.has(m.userId)) ctx.addIssue({ code: "custom", message: "Un membre est sélectionné deux fois" });
      ids.add(m.userId);
    }
    if (crew.filter((m) => m.crewRole === "ROWER").length === 0)
      ctx.addIssue({ code: "custom", message: "L'équipage doit comporter au moins un rameur" });
    if (crew.filter((m) => m.crewRole === "COXSWAIN").length > 1)
      ctx.addIssue({ code: "custom", message: "Un seul barreur par bateau" });
  });

const notesSchema = z
  .string()
  .max(1000, "Commentaire trop long (1000 caractères max.)")
  .optional()
  .transform((s) => (s && s.trim() ? s.trim() : undefined));

/** Mode A — départ en temps réel */
export const startOutingSchema = z.object({
  boatId: z.string().min(1, "Choisissez un bateau"),
  crew: crewSchema,
  direction: directionSchema,
  departureDate: dateStr,
  departureTime: timeStr,
  notes: notesSchema,
});

/** Mode A — retour */
export const finishOutingSchema = z.object({
  returnDate: dateStr,
  returnTime: timeStr,
  distanceKm: distanceSchema,
  notes: notesSchema,
});

/** Mode B — sortie passée */
export const retrospectiveOutingSchema = z.object({
  date: dateStr,
  boatId: z.string().min(1, "Choisissez un bateau"),
  crew: crewSchema,
  direction: directionSchema,
  departureTime: timeStr,
  returnTime: timeStr,
  distanceKm: distanceSchema,
  notes: notesSchema,
  /** Correction administrative : autoriser explicitement un chevauchement */
  allowOverlap: z.boolean().optional().default(false),
});

/** Modification d'une sortie (en cours ou terminée). */
export const updateOutingSchema = z.object({
  date: dateStr,
  boatId: z.string().min(1, "Choisissez un bateau"),
  crew: crewSchema,
  direction: directionSchema,
  departureTime: timeStr,
  returnTime: timeStr.optional(),
  distanceKm: distanceSchema.optional(),
  notes: notesSchema,
  allowOverlap: z.boolean().optional().default(false),
  /** Motif de la correction (journal d'audit) */
  reason: z.string().max(500).optional(),
});

export const cancelOutingSchema = z.object({
  reason: z.string().trim().min(3, "Indiquez le motif de l'annulation").max(500),
});

export type StartOutingInput = z.input<typeof startOutingSchema>;
export type StartOutingData = z.output<typeof startOutingSchema>;
export type FinishOutingInput = z.input<typeof finishOutingSchema>;
export type FinishOutingData = z.output<typeof finishOutingSchema>;
export type RetrospectiveOutingInput = z.input<typeof retrospectiveOutingSchema>;
export type RetrospectiveOutingData = z.output<typeof retrospectiveOutingSchema>;
export type UpdateOutingInput = z.input<typeof updateOutingSchema>;
export type UpdateOutingData = z.output<typeof updateOutingSchema>;
export type CrewMemberInput = z.infer<typeof crewMemberSchema>;
