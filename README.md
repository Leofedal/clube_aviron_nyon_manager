# Club Aviron de Nyon — Gestion des sorties

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

Prérequis : Node.js 20+ et une base PostgreSQL 14+. Le plus simple est
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows, macOS, Linux).

```bash
npm install
docker compose up -d        # démarre PostgreSQL sur le port 5433 (+ base de test)
cp .env.example .env        # Windows PowerShell : copy .env.example .env
npm run db:migrate          # crée le schéma et les contraintes
npm run db:seed             # données de démonstration
npm run dev                 # http://localhost:3000
```

Sans Docker : installez PostgreSQL ou créez une base gratuite chez [Neon](https://neon.tech), puis remplacez
`DATABASE_URL` et `DIRECT_URL` dans `.env` par l'adresse fournie.

### Comptes de démonstration

Créés par `npm run db:seed`. Mot de passe : la valeur de `SEED_ADMIN_PASSWORD` dans `.env`
(`aviron-demo-2026` avec le `.env.example` fourni).

| Rôle | Nom | E-mail | Mot de passe |
|---|---|---|---|
| Administrateur | Claire Martin | `admin@aviron.example` | `aviron-demo-2026` |
| Membre | Marc Dubois | `marc.dubois@aviron.example` | `aviron-demo-2026` |

Les 14 autres membres suivent le modèle `prenom.nom@aviron.example`, sans accents
(ex. `julie.favre@aviron.example`, `lea.bonvin@aviron.example`), avec le même mot de passe.
Thomas Vuille est un ancien membre désactivé : il ne peut pas se connecter.

Avec `DEMO_LOGIN="true"` dans `.env`, la page de connexion affiche deux boutons « Administrateur » et « Membre »
pour se connecter en un clic. **Ne jamais l'activer sur le site réel du club.**
Le seed **efface la base** et refuse de s'exécuter en production (sauf `ALLOW_DEMO_SEED=true`).

### Mode démonstration du tableau de bord

Avec `DEMO_LOGIN="true"`, on peut simuler l'heure et le vent en ajoutant des paramètres à l'adresse du tableau de bord.
Un bandeau « Simulation » signale que les données sont fictives. Ignoré quand `DEMO_LOGIN` n'est pas activé.

| Pour montrer… | Adresse |
|---|---|
| Coucher du soleil dans moins d'une heure (alerte rouge) | `http://localhost:3000/?heure=16:30` |
| Soleil déjà couché (heure du lever) | `http://localhost:3000/?heure=18:00` |
| Coucher du soleil encore loin | `http://localhost:3000/?heure=10:00` |
| Vent faible | `http://localhost:3000/?vent=6&rafales=10&direction=45` |
| Bise modérée | `http://localhost:3000/?vent=15&rafales=24&direction=45` |
| Joran fort | `http://localhost:3000/?vent=24&rafales=38&direction=315` |
| Vent très fort, sortie déconseillée | `http://localhost:3000/?vent=35&rafales=50&direction=230` |
| Tout combiné | `http://localhost:3000/?heure=16:30&vent=24&rafales=38&direction=315` |

`direction` = d'où vient le vent, en degrés (45 = nord-est / Bise, 230 = sud-ouest / Vent, 315 = nord-ouest / Joran).

## Tests

Les tests d'intégration utilisent une vraie base PostgreSQL dédiée (`.env.test`, le nom doit contenir « test »).

```bash
cp .env.test.example .env.test      # base rowing_test déjà créée par docker compose
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
- **Direction** obligatoire pour chaque sortie : Genève ou Lausanne (filtre du registre, statistiques, export CSV).
- **Météo du tableau de bord** : vent en priorité (vitesse, rafales, provenance, Bise / Vent / Joran, niveau indicatif
  pour l'aviron, prochaines heures), coucher du soleil et température. Source : [Open-Meteo](https://open-meteo.com)
  (gratuit, sans clé, modèles MétéoSuisse inclus), mis en cache 10 minutes côté serveur. Si le service est indisponible,
  le tableau de bord s'affiche normalement avec un message. Le coucher du soleil est calculé localement
  (`src/lib/sun.ts`). Seuils de vent modifiables dans `src/lib/wind.ts`, position du club dans `src/lib/club.ts`.
- **Étiquettes d'avertissement** sur les bateaux (ex. « Compétiteurs ou chevronnés seulement ») : définies par les
  administrateurs, affichées au choix du bateau et dans les formulaires. Purement informatives, elles ne bloquent pas la sortie.
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
