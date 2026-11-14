import { z } from "zod";
export const PASSWORD_MIN_LENGTH = 10;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const memberSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(60),
  lastName: z.string().trim().min(1, "Nom requis").max(60),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  role: z.enum(["ADMIN", "MEMBER"]),
  isActive: z.boolean(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères`),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });

export const boatSchema = z
  .object({
    name: z.string().trim().min(1, "Nom requis").max(80),
    boatTypeId: z.string().min(1, "Type requis"),
    rowingCapacity: z.coerce.number().int().min(1, "Au moins 1 rameur").max(8, "8 rameurs maximum"),
    coxswainCapacity: z.coerce.number().int().min(0).max(1, "1 barreur maximum"),
    maintenanceStatus: z.enum(["AVAILABLE", "MAINTENANCE", "UNAVAILABLE"]),
    notes: z
      .string()
      .max(1000)
      .optional()
      .transform((s) => (s && s.trim() ? s.trim() : null)),
    /** Étiquettes d'avertissement (informatives) */
    tags: z
      .array(z.string().trim().min(1).max(60, "Étiquette trop longue (60 caractères max.)"))
      .max(5, "5 étiquettes maximum")
      .optional()
      .default([])
      .transform((t) => [...new Map(t.map((x) => [x.toLowerCase(), x])).values()]),
  });

export const boatTypeSchema = z.object({
  code: z.string().trim().min(1, "Code requis").max(10),
  label: z.string().trim().min(1, "Libellé requis").max(60),
  defaultRowingCapacity: z.coerce.number().int().min(1).max(8),
  defaultCoxswainCapacity: z.coerce.number().int().min(0).max(1),
});

export type MemberInput = z.input<typeof memberSchema>;
export type BoatInput = z.input<typeof boatSchema>;
export type BoatData = z.output<typeof boatSchema>;
export type BoatTypeInput = z.input<typeof boatTypeSchema>;
