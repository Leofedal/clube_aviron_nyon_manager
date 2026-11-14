# Rowing Club Manager

Application web de gestion des sorties d'un club d'aviron : registre des sorties (remplace le carnet papier),
fiches bateaux et membres, tableau de bord et statistiques. Interface en français, responsive
(ordinateur, tablette, smartphone), mode clair et sombre.

## Deux façons d'enregistrer une sortie

| | Mode A — Départ en temps réel | Mode B — Sortie passée |
|---|---|---|
| Accès | « Démarrer une sortie » | « Ajouter une sortie passée » |
| Parcours | 1. bateau → 2. équipage → 3. confirmation (heure pré-remplie) | Formulaire unique |
| À la création | Statut **En cours**, le bateau est occupé | Statut **Terminée** |
| Fin | « Terminer la sortie » : heure de retour, km, commentaire | — |
| `entryMode` en base | `LIVE` | `RETROSPECTIVE` |

Les deux modes écrivent dans la même table `Outing` : registre, bateaux, profils et statistiques sont alimentés de la même façon.
Le lien `/sorties/demarrer?bateau=<id>` pré-sélectionne un bateau (prévu pour de futurs QR codes).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · PostgreSQL · Prisma 6 ·
React Hook Form · Zod · Recharts · Lucide · Vitest.

**Authentification** : sessions en base de données (cookie httpOnly, jeton aléatoire de 256 bits dont seul le hash
SHA-256 est stocké, mots de passe bcrypt). Choisie plutôt qu'Auth.js pour pouvoir révoquer immédiatement les
sessions d'un membre désactivé et éviter une dépendance encore en bêta. Toutes les permissions sont vérifiées
côté serveur (services métier), l'interface ne fait que masquer les actions non autorisées.

## Démarrage local

Prérequis : Node.js 20+ et PostgreSQL 14+ (l'extension `btree_gist`, standard, est activée par la migration).

```bash
npm install
cp .env.example .env        # puis renseigner DATABASE_URL, DIRECT_URL, SEED_ADMIN_PASSWORD
npm run db:migrate          # crée le schéma et les contraintes
npm run db:seed             # données de démonstration
npm run dev                 # http://localhost:3000
```

Comptes de démonstration : `admin@aviron.example` (administrateur) et `prenom.nom@aviron.example`
(ex. `marc.dubois@aviron.example`), mot de passe = valeur de `SEED_ADMIN_PASSWORD`.
Le seed **efface la base** et refuse de s'exécuter en production (sauf `ALLOW_DEMO_SEED=true`).

## Tests

Les tests d'intégration utilisent une vraie base PostgreSQL dédiée (`.env.test`, le nom doit contenir « test »).

```bash
createdb rowing_test                # une seule fois
npm run db:test:prepare             # applique les migrations à la base de test
npm test
```

58 tests couvrent : départ, retour (y compris double retour simultané), saisie rétrospective, sorties traversant
minuit, changements d'heure (DST), chevauchements bateau et équipage, concurrence entre départs simultanés,
capacité des bateaux, permissions, distances club vs individuelles (4 rameurs × 15 km = 15 km club),
barreurs, filtrage par date, recalcul après correction, sorties annulées exclues, contraintes de la base.

## Règles métier et intégrité

- **Horodatages** stockés en UTC (`timestamptz`), saisis et affichés en `Europe/Zurich` (module `src/lib/time.ts`).
  Si l'heure de retour est ≤ l'heure de départ, la sortie est considérée comme se terminant le lendemain.
- **Concurrence**, trois niveaux : verrous transactionnels `pg_advisory_xact_lock` par bateau et par membre ;
  vérifications dans la transaction ; contraintes PostgreSQL :
  - index unique partiel : une seule sortie `IN_PROGRESS` par bateau ;
  - contrainte d'exclusion GiST : pas de chevauchement de périodes pour un même bateau ;
  - `CHECK` : retour > départ, distance ≥ 0, sortie terminée ⇒ retour + distance.
- **Chevauchement autorisé** uniquement par un administrateur, explicitement (`overlapApproved`), et tracé
  dans le journal d'audit (`OVERLAP_OVERRIDE`).
- **Disponibilité « Sur l'eau »** dérivée des sorties en cours, jamais stockée. Les bateaux en maintenance ou
  indisponibles ne peuvent pas partir.
- **Statistiques** calculées en SQL à la demande (aucun total stocké) : uniquement les sorties terminées,
  attribuées à leur date de départ ; chaque équipier reçoit la distance totale ; km ramés / barrés distingués.
- **Annulation** = suppression logique (historique conservé, exclue des statistiques).
- **Membres désactivés** : connexion impossible, sessions révoquées, historique et statistiques conservés.

## Permissions

| Action | Membre | Admin |
|---|---|---|
| Démarrer / ajouter une sortie passée | ✔ | ✔ |
| Terminer une sortie | si équipier ou auteur | ✔ |
| Modifier une sortie | ses sorties des 7 derniers jours | ✔ (avec motif tracé) |
| Annuler une sortie | sa sortie en cours, < 30 min après création | ✔ |
| Inclure un ancien membre (archives) | — | ✔ |
| Gérer membres, bateaux, types de bateaux | — | ✔ |
| Export CSV, journal d'audit | — | ✔ |

## Déploiement (Vercel + PostgreSQL)

1. Créer une base PostgreSQL compatible (Neon, Supabase, Vercel Postgres…). Vérifier que l'extension
   `btree_gist` est disponible (c'est le cas chez Neon et Supabase).
2. Dans Vercel → *Settings → Environment Variables* :
   - `DATABASE_URL` : URL **poolée** (pgBouncer) si disponible ;
   - `DIRECT_URL` : URL **directe** (utilisée par les migrations).
3. Appliquer les migrations depuis votre poste ou la CI : `DATABASE_URL=… DIRECT_URL=… npm run db:deploy`.
4. Créer le premier administrateur : soit en lançant une fois le seed sur une base de préproduction,
   soit via `npx prisma studio` avec un hash bcrypt. **Ne jamais utiliser les comptes de démonstration en production.**
5. La commande de build (`prisma generate && next build`) est déjà configurée dans `package.json`.

## Architecture

```
prisma/                 schéma, migrations (contraintes SQL), seed
src/lib/
  services/             logique métier : outings (écriture), outing-queries, stats, boats, members, audit
  validation/           schémas Zod partagés client/serveur
  auth/                 sessions et mots de passe
  permissions.ts        règles d'accès (fonctions pures)
  time.ts, periods.ts   fuseau horaire et périodes
src/app/
  actions/              server actions minces (auth + appel des services)
  (app)/                pages authentifiées : /, /sorties, /bateaux, /membres, /statistiques, /journal, /profil
  api/export/sorties    export CSV (séparateur « ; », UTF-8 BOM pour Excel)
src/components/         ui (shadcn), layout, outings, boats, members, stats
tests/                  unit/ et integration/
```

## Évolutions prévues par l'architecture

QR codes par bateau (lien de départ déjà en place), signalement de matériel endommagé (statut de maintenance +
journal), calendrier et réservations (nouvelle table liée à `Boat`, mêmes contraintes d'exclusion), notifications
aux responsables (points d'accroche : services `startOuting` / `setBoatMaintenance`), exports Excel/PDF
(réutiliser `listOutingsForExport`), statistiques annuelles (période « Cette année » / personnalisée).
