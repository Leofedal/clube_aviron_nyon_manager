"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import {
  cancelOuting,
  createRetrospectiveOuting,
  finishOuting,
  startOuting,
  updateOuting,
} from "@/lib/services/outings";
import type {
  FinishOutingInput,
  RetrospectiveOutingInput,
  StartOutingInput,
  UpdateOutingInput,
} from "@/lib/validation/outing";

function refresh() {
  // Registre, tableau de bord, bateaux, membres et statistiques dépendent tous des sorties.
  revalidatePath("/", "layout");
}

const actorOf = (u: { id: string; role: "ADMIN" | "MEMBER" }) => ({ id: u.id, role: u.role });

export async function startOutingAction(input: StartOutingInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  try {
    const o = await startOuting(actorOf(user), input);
    refresh();
    return { ok: true, data: { id: o.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function finishOutingAction(id: string, input: FinishOutingInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  try {
    const o = await finishOuting(actorOf(user), id, input);
    refresh();
    return { ok: true, data: { id: o.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createRetrospectiveOutingAction(
  input: RetrospectiveOutingInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  try {
    const o = await createRetrospectiveOuting(actorOf(user), input);
    refresh();
    return { ok: true, data: { id: o.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateOutingAction(id: string, input: UpdateOutingInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  try {
    const o = await updateOuting(actorOf(user), id, input);
    refresh();
    return { ok: true, data: { id: o.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function cancelOutingAction(id: string, reason: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await cancelOuting(actorOf(user), id, { reason });
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
