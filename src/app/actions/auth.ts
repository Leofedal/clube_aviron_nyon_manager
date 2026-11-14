"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { authenticate, changeOwnPassword } from "@/lib/services/members";
import { loginSchema, passwordChangeSchema } from "@/lib/validation/admin";
import { toActionError, type ActionResult } from "@/lib/errors";

// Limitation simple des tentatives de connexion (par instance serveur).
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export async function loginAction(input: { email: string; password: string; next?: string }): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const h = await headers();
  const key = `${h.get("x-forwarded-for")?.split(",")[0] ?? "local"}:${parsed.data.email}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.until > now && entry.count >= MAX_ATTEMPTS) {
    return { ok: false, error: "Trop de tentatives. Réessayez dans quelques minutes." };
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    attempts.set(key, { count: (entry && entry.until > now ? entry.count : 0) + 1, until: now + WINDOW_MS });
    return { ok: false, error: "E-mail ou mot de passe incorrect." };
  }
  attempts.delete(key);
  await createSession(user.id);
  const next = input.next && input.next.startsWith("/") && !input.next.startsWith("//") ? input.next : "/";
  redirect(next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/connexion");
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirm: string;
}): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await changeOwnPassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
