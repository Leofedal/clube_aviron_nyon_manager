"use server";
import { revalidatePath } from "next/cache";
import type { MaintenanceStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { createBoat, createBoatType, setBoatMaintenance, updateBoat } from "@/lib/services/boats";
import type { BoatInput, BoatTypeInput } from "@/lib/validation/admin";

export async function saveBoatAction(id: string | null, input: BoatInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  try {
    const b = id ? await updateBoat(user, id, input) : await createBoat(user, input);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: b.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setMaintenanceAction(id: string, status: MaintenanceStatus): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await setBoatMaintenance(user, id, status);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createBoatTypeAction(input: BoatTypeInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  try {
    const t = await createBoatType(user, input);
    revalidatePath("/bateaux");
    return { ok: true, data: { id: t.id } };
  } catch (e) {
    return toActionError(e);
  }
}
