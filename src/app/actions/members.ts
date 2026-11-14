"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { toActionError, type ActionResult } from "@/lib/errors";
import { createMember, resetMemberPassword, updateMember } from "@/lib/services/members";
import type { MemberInput } from "@/lib/validation/admin";

export async function saveMemberAction(
  id: string | null,
  input: MemberInput,
): Promise<ActionResult<{ id: string; temporaryPassword?: string }>> {
  const user = await requireUser();
  try {
    if (id) {
      const u = await updateMember(user, id, input);
      revalidatePath("/", "layout");
      return { ok: true, data: { id: u.id } };
    }
    const { user: u, temporaryPassword } = await createMember(user, input);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: u.id, temporaryPassword } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function resetPasswordAction(id: string): Promise<ActionResult<{ temporaryPassword: string }>> {
  const user = await requireUser();
  try {
    const temporaryPassword = await resetMemberPassword(user, id);
    return { ok: true, data: { temporaryPassword } };
  } catch (e) {
    return toActionError(e);
  }
}
