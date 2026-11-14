/**
 * Données de démonstration : 1 administrateur, 15 membres, 8 bateaux,
 * 50 sorties historiques (sur ~8 mois) et 3 sorties en cours.
 *
 * Les sorties sont créées via les services métier (mêmes validations que l'application).
 * Refusé en production, sauf ALLOW_DEMO_SEED=true explicite.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { createRetrospectiveOuting, finishOuting, startOuting } from "../src/lib/services/outings";
import { addDaysToDateString, resolveOutingTimes, toLocalDateString, toLocalTimeString } from "../src/lib/time";
import type { Actor } from "../src/lib/permissions";
import { DomainError } from "../src/lib/errors";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("✖ Seed de démonstration refusé en production (définir ALLOW_DEMO_SEED=true pour forcer).");
  process.exit(1);
}

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const MEMBER_PASSWORD = process.env.SEED_MEMBER_PASSWORD ?? ADMIN_PASSWORD;
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) {
  console.error("✖ Définissez SEED_ADMIN_PASSWORD (10 caractères minimum) dans .env");
  process.exit(1);
}

// Générateur pseudo-aléatoire déterministe (données reproductibles)
let state = 20261114;
const rand = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const shuffle = <T,>(arr: T[]) => [...arr].sort(() => rand() - 0.5);
const pad = (n: number) => n.toString().padStart(2, "0");

const BOAT_TYPES = [
  { code: "1x", label: "Skiff", defaultRowingCapacity: 1, defaultCoxswainCapacity: 0, sortOrder: 10 },
  { code: "2x", label: "Deux de couple", defaultRowingCapacity: 2, defaultCoxswainCapacity: 0, sortOrder: 20 },
  { code: "2-", label: "Deux sans barreur", defaultRowingCapacity: 2, defaultCoxswainCapacity: 0, sortOrder: 30 },
  { code: "4x", label: "Quatre de couple", defaultRowingCapacity: 4, defaultCoxswainCapacity: 0, sortOrder: 40 },
  { code: "4-", label: "Quatre sans barreur", defaultRowingCapacity: 4, defaultCoxswainCapacity: 0, sortOrder: 50 },
  { code: "4+", label: "Quatre avec barreur", defaultRowingCapacity: 4, defaultCoxswainCapacity: 1, sortOrder: 60 },
  { code: "8+", label: "Huit avec barreur", defaultRowingCapacity: 8, defaultCoxswainCapacity: 1, sortOrder: 70 },
];

const BOATS: { name: string; type: string; notes?: string; maintenance?: "MAINTENANCE"; tags?: string[] }[] = [
  { name: "Albatros", type: "1x" },
  { name: "Mouette", type: "1x", notes: "Fissure sur la coque à réparer", maintenance: "MAINTENANCE" },
  { name: "Filippi 2x", type: "2x" },
  { name: "Rhône", type: "2-" },
  { name: "Empacher 4x", type: "4x", tags: ["Compétiteurs ou chevronnés seulement"] },
  { name: "Aar", type: "4-" },
  { name: "Jura", type: "4+" },
  {
    name: "Helvetia",
    type: "8+",
    notes: "Bateau d'équipe — réservé aux entraînements du mardi et jeudi",
    tags: ["Compétiteurs ou chevronnés seulement", "Entraîneur à proximité"],
  },
];

const MEMBERS = [
  ["Marc", "Dubois"], ["Julie", "Favre"], ["Paul", "Rochat"], ["Léa", "Bonvin"], ["Tom", "Meier"],
  ["Anna", "Keller"], ["Lucas", "Morel"], ["Chloé", "Perrin"], ["Nicolas", "Girard"], ["Sophie", "Blanc"],
  ["Hugo", "Muller"], ["Emma", "Fontaine"], ["Julien", "Roux"], ["Camille", "Schmid"], ["Thomas", "Vuille"],
];

async function main() {
  console.log("→ Nettoyage de la base…");
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AuditLog", "OutingCrew", "Outing", "Session", "Boat", "BoatType", "User" CASCADE`,
  );

  console.log("→ Utilisateurs…");
  const adminHash = await hashPassword(ADMIN_PASSWORD!);
  const memberHash = await hashPassword(MEMBER_PASSWORD!);
  const admin = await prisma.user.create({
    data: { firstName: "Claire", lastName: "Martin", email: "admin@aviron.example", passwordHash: adminHash, role: "ADMIN" },
  });
  const members = [];
  for (const [firstName, lastName] of MEMBERS) {
    const email = `${firstName}.${lastName}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    members.push(
      await prisma.user.create({
        data: { firstName, lastName, email: `${email}@aviron.example`, passwordHash: memberHash },
      }),
    );
  }

  console.log("→ Bateaux…");
  const types = new Map<string, string>();
  for (const t of BOAT_TYPES) types.set(t.code, (await prisma.boatType.create({ data: t })).id);
  const boats = [];
  for (const b of BOATS) {
    const t = BOAT_TYPES.find((x) => x.code === b.type)!;
    boats.push(
      await prisma.boat.create({
        data: {
          name: b.name,
          boatTypeId: types.get(b.type)!,
          rowingCapacity: t.defaultRowingCapacity,
          coxswainCapacity: t.defaultCoxswainCapacity,
          notes: b.notes,
          tags: b.tags ?? [],
        },
      }),
    );
  }

  const everyone = [admin, ...members];
  const today = toLocalDateString(new Date());

  console.log("→ 50 sorties historiques…");
  let created = 0;
  let attempts = 0;
  const started = Date.now();
  while (created < 50 && attempts < 300) {
    attempts++;
    const daysAgo = 1 + Math.floor(rand() * 240);
    const date = addDaysToDateString(today, -daysAgo);
    const boat = pick(boats);
    const crewPeople = shuffle(everyone).slice(0, boat.rowingCapacity + boat.coxswainCapacity);
    const crew = crewPeople.map((u, i) => ({
      userId: u.id,
      crewRole: (i >= boat.rowingCapacity ? "COXSWAIN" : "ROWER") as "ROWER" | "COXSWAIN",
    }));
    const morning = rand() < 0.6;
    const startH = morning ? 6 + Math.floor(rand() * 3) : 17 + Math.floor(rand() * 2);
    const startM = pick([0, 15, 30, 45]);
    const durationMin = 50 + Math.floor(rand() * 9) * 10;
    const kmPerHour = boat.rowingCapacity >= 4 ? 11 : 9;
    const km = Math.round((durationMin / 60) * kmPerHour * (0.85 + rand() * 0.3) * 10) / 10;
    const endTotal = startH * 60 + startM + durationMin;
    const departureTime = `${pad(startH)}:${pad(startM)}`;
    const returnTime = `${pad(Math.floor(endTotal / 60) % 24)}:${pad(endTotal % 60)}`;
    const notes = rand() < 0.25 ? pick(["Lac calme, très belle sortie", "Un peu de vent au retour", "Travail technique", "Sortie longue distance", "Brouillard au départ"]) : undefined;
    const direction = (rand() < 0.5 ? "GENEVA" : "LAUSANNE") as "GENEVA" | "LAUSANNE";
    const author: Actor = { id: crew[0].userId, role: crew[0].userId === admin.id ? "ADMIN" : "MEMBER" };

    try {
      if (rand() < 0.6) {
        // Saisie en temps réel : départ puis retour, « maintenant » simulé à la date de la sortie
        const { departureAt, returnAt } = resolveOutingTimes(date, departureTime, returnTime);
        const o = await startOuting(
          author,
          { boatId: boat.id, crew, direction, departureDate: date, departureTime, notes },
          new Date(departureAt.getTime() + 60000),
        );
        await finishOuting(
          author,
          o.id,
          { returnDate: toLocalDateString(returnAt), returnTime, distanceKm: km },
          new Date(returnAt.getTime() + 60000),
        );
      } else {
        await createRetrospectiveOuting(author, {
          date, boatId: boat.id, crew, direction, departureTime, returnTime, distanceKm: km, notes,
        });
      }
      created++;
      if (created % 5 === 0) {
        console.log(`   ${created}/50 sorties (${Math.round((Date.now() - started) / 1000)} s)`);
      }
    } catch (e) {
      // Conflit métier (bateau ou équipier déjà pris) : on tire une autre combinaison.
      // Toute autre erreur (connexion, délai dépassé…) est affichée et arrête le seed.
      if (!(e instanceof DomainError)) throw e;
    }
  }
  if (created < 50) console.warn(`⚠ Seulement ${created} sorties historiques créées.`);

  console.log("→ 3 sorties en cours…");
  const now = Date.now();
  const live = [
    { boat: "Filippi 2x", crew: [members[0], members[1]], minutesAgo: 35, direction: "LAUSANNE" as const },
    { boat: "Empacher 4x", crew: [members[2], members[3], members[4], members[5]], minutesAgo: 70, direction: "GENEVA" as const },
    { boat: "Albatros", crew: [members[6]], minutesAgo: 15, direction: "LAUSANNE" as const },
  ];
  for (const l of live) {
    const boat = boats.find((b) => b.name === l.boat)!;
    const dep = new Date(now - l.minutesAgo * 60000);
    await startOuting(
      { id: l.crew[0].id, role: "MEMBER" },
      {
        boatId: boat.id,
        crew: l.crew.map((u) => ({ userId: u.id, crewRole: "ROWER" as const })),
        direction: l.direction,
        departureDate: toLocalDateString(dep),
        departureTime: toLocalTimeString(dep),
      },
    );
  }

  // Bateau en maintenance (après les sorties historiques) et membre désactivé (historique conservé)
  await prisma.boat.update({ where: { name: "Mouette" }, data: { maintenanceStatus: "MAINTENANCE" } });
  await prisma.user.update({ where: { id: members[14].id }, data: { isActive: false } });

  const [o, ip] = await Promise.all([
    prisma.outing.count({ where: { status: "COMPLETED" } }),
    prisma.outing.count({ where: { status: "IN_PROGRESS" } }),
  ]);
  console.log(`✔ Seed terminé : ${everyone.length} utilisateurs, ${boats.length} bateaux, ${o} sorties terminées, ${ip} en cours.`);
  console.log("  Administrateur : admin@aviron.example");
  console.log("  Membres        : prenom.nom@aviron.example (ex. marc.dubois@aviron.example)");
  console.log("  Mots de passe  : valeurs de SEED_ADMIN_PASSWORD / SEED_MEMBER_PASSWORD (.env)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
