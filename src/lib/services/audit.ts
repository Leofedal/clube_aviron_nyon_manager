import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/prisma";

export type AuditAction =
  | "CREATE"
  | "START"
  | "FINISH"
  | "UPDATE"
  | "CANCEL"
  | "OVERLAP_OVERRIDE"
  | "DEACTIVATE"
  | "REACTIVATE"
  | "PASSWORD_RESET"
  | "ROLE_CHANGE";

/** Convertit Decimal / Date en valeurs JSON stables pour le journal. */
export function toAuditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (v && typeof v === "object" && "toFixed" in v && typeof v.toFixed === "function" && "d" in v) {
        return Number(v.toString());
      }
      return v;
    }),
  );
}

export async function writeAudit(
  tx: Tx,
  entry: {
    actorId: string | null;
    entityType: "Outing" | "Boat" | "User" | "BoatType";
    entityId: string;
    action: AuditAction;
    previousValues?: unknown;
    newValues?: unknown;
  },
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      previousValues: entry.previousValues === undefined ? undefined : toAuditJson(entry.previousValues),
      newValues: entry.newValues === undefined ? undefined : toAuditJson(entry.newValues),
    },
  });
}
