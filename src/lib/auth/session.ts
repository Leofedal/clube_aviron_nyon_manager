import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/**
 * Authentification par sessions stockées en base de données :
 * - jeton aléatoire de 256 bits dans un cookie httpOnly / SameSite=Lax / Secure (prod)
 * - seul le hash SHA-256 du jeton est stocké → une fuite de la base ne permet pas d'usurper une session
 * - révocation immédiate (déconnexion, désactivation d'un membre)
 */
export const SESSION_COOKIE = "rcm_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  // Nettoyage opportuniste des sessions expirées
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/** Utilisateur connecté (mis en cache pour la durée de la requête). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const { id, firstName, lastName, email, role } = session.user;
  return { id, firstName, lastName, email, role };
});

/** À utiliser dans les pages et actions : redirige vers la connexion si nécessaire. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/?erreur=acces-refuse");
  return user;
}
