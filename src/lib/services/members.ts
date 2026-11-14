import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/errors";
import { canManageMembers, type Actor } from "@/lib/permissions";
import { memberSchema, type MemberInput } from "@/lib/validation/admin";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "@/lib/auth/password";
import { writeAudit } from "./audit";

const publicUser = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const ROLE_LABELS = { ADMIN: "Administrateur", MEMBER: "Membre" } as const;

/** Membres pour les sélecteurs d'équipage. */
export function listMembersForPicker(opts: { includeInactive?: boolean } = {}) {
  return prisma.user.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    select: { id: true, firstName: true, lastName: true, isActive: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export type PickerMember = Awaited<ReturnType<typeof listMembersForPicker>>[number];

export function getMember(id: string) {
  return prisma.user.findUnique({ where: { id }, select: publicUser });
}

function assertAdmin(actor: Actor) {
  if (!canManageMembers(actor)) throw new DomainError("FORBIDDEN", "Action réservée aux administrateurs.");
}

function parseMember(input: MemberInput) {
  const r = memberSchema.safeParse(input);
  if (!r.success) throw new DomainError("VALIDATION", r.error.issues[0]?.message ?? "Données invalides");
  return r.data;
}

/** Crée un membre et renvoie un mot de passe temporaire à lui transmettre. */
export async function createMember(actor: Actor, input: MemberInput) {
  assertAdmin(actor);
  const data = parseMember(input);
  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    throw new DomainError("CONFLICT", "Un membre utilise déjà cette adresse e-mail.");
  }
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { ...data, passwordHash }, select: publicUser });
    await writeAudit(tx, { actorId: actor.id, entityType: "User", entityId: u.id, action: "CREATE", newValues: u });
    return u;
  });
  return { user, temporaryPassword };
}

export async function updateMember(actor: Actor, userId: string, input: MemberInput) {
  assertAdmin(actor);
  const data = parseMember(input);
  if (userId === actor.id && (data.role !== "ADMIN" || !data.isActive)) {
    throw new DomainError("VALIDATION", "Vous ne pouvez pas retirer vos propres droits d'administrateur ni vous désactiver.");
  }
  const clash = await prisma.user.findFirst({ where: { email: data.email, id: { not: userId } } });
  if (clash) throw new DomainError("CONFLICT", "Un autre membre utilise déjà cette adresse e-mail.");

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUnique({ where: { id: userId }, select: publicUser });
    if (!before) throw new DomainError("NOT_FOUND", "Membre introuvable.");
    if (before.role === "ADMIN" && data.role !== "ADMIN") {
      const admins = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
      if (admins <= 1) throw new DomainError("VALIDATION", "Le club doit conserver au moins un administrateur actif.");
    }
    const user = await tx.user.update({ where: { id: userId }, data, select: publicUser });
    // La désactivation révoque immédiatement les sessions ; l'historique des sorties est conservé.
    if (before.isActive && !user.isActive) await tx.session.deleteMany({ where: { userId } });
    const action =
      before.isActive !== user.isActive
        ? user.isActive
          ? "REACTIVATE"
          : "DEACTIVATE"
        : before.role !== user.role
          ? "ROLE_CHANGE"
          : "UPDATE";
    await writeAudit(tx, {
      actorId: actor.id,
      entityType: "User",
      entityId: userId,
      action,
      previousValues: before,
      newValues: user,
    });
    return user;
  });
}

export async function resetMemberPassword(actor: Actor, userId: string) {
  assertAdmin(actor);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId } });
    await writeAudit(tx, { actorId: actor.id, entityType: "User", entityId: userId, action: "PASSWORD_RESET" });
  });
  return temporaryPassword;
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new DomainError("VALIDATION", "Mot de passe actuel incorrect.");
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
}

/** Vérifie les identifiants. Message volontairement générique. */
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Comparaison effectuée même si l'utilisateur n'existe pas (temps de réponse constant).
  const ok = await verifyPassword(
    password,
    user?.passwordHash ?? "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5Q1k5Q1k5Q1k5Q1k5Q1k5Q1k5Q1k5Q1",
  );
  if (!user || !ok || !user.isActive) return null;
  return user;
}
