-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "OutingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntryMode" AS ENUM ('LIVE', 'RETROSPECTIVE');

-- CreateEnum
CREATE TYPE "CrewRole" AS ENUM ('ROWER', 'COXSWAIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoatType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "defaultRowingCapacity" INTEGER NOT NULL,
    "defaultCoxswainCapacity" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoatType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boat" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boatTypeId" TEXT NOT NULL,
    "rowingCapacity" INTEGER NOT NULL,
    "coxswainCapacity" INTEGER NOT NULL DEFAULT 0,
    "maintenanceStatus" "MaintenanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Boat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outing" (
    "id" TEXT NOT NULL,
    "boatId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "departureAt" TIMESTAMPTZ(3) NOT NULL,
    "returnAt" TIMESTAMPTZ(3),
    "distanceKm" DECIMAL(6,2),
    "status" "OutingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "entryMode" "EntryMode" NOT NULL,
    "notes" TEXT,
    "overlapApproved" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Outing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutingCrew" (
    "id" TEXT NOT NULL,
    "outingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "crewRole" "CrewRole" NOT NULL DEFAULT 'ROWER',
    "seat" INTEGER,

    CONSTRAINT "OutingCrew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValues" JSONB,
    "newValues" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_lastName_firstName_idx" ON "User"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BoatType_code_key" ON "BoatType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Boat_name_key" ON "Boat"("name");

-- CreateIndex
CREATE INDEX "Outing_departureAt_idx" ON "Outing"("departureAt");

-- CreateIndex
CREATE INDEX "Outing_boatId_departureAt_idx" ON "Outing"("boatId", "departureAt");

-- CreateIndex
CREATE INDEX "Outing_status_idx" ON "Outing"("status");

-- CreateIndex
CREATE INDEX "OutingCrew_userId_idx" ON "OutingCrew"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OutingCrew_outingId_userId_key" ON "OutingCrew"("outingId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boat" ADD CONSTRAINT "Boat_boatTypeId_fkey" FOREIGN KEY ("boatTypeId") REFERENCES "BoatType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outing" ADD CONSTRAINT "Outing_boatId_fkey" FOREIGN KEY ("boatId") REFERENCES "Boat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outing" ADD CONSTRAINT "Outing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outing" ADD CONSTRAINT "Outing_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutingCrew" ADD CONSTRAINT "OutingCrew_outingId_fkey" FOREIGN KEY ("outingId") REFERENCES "Outing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutingCrew" ADD CONSTRAINT "OutingCrew_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Règles métier garanties par PostgreSQL (protection contre la concurrence)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Un bateau ne peut avoir qu'une seule sortie en cours à la fois.
CREATE UNIQUE INDEX "Outing_one_active_per_boat"
  ON "Outing" ("boatId")
  WHERE "status" = 'IN_PROGRESS';

-- Aucune période d'utilisation ne peut se chevaucher pour un même bateau
-- (une sortie en cours occupe le bateau jusqu'à l'infini).
-- Exceptions : sorties annulées, et chevauchements approuvés par un administrateur.
ALTER TABLE "Outing" ADD CONSTRAINT "Outing_no_boat_overlap"
  EXCLUDE USING gist (
    "boatId" WITH =,
    tstzrange("departureAt", COALESCE("returnAt", 'infinity'::timestamptz), '[)') WITH &&
  ) WHERE ("status" <> 'CANCELLED' AND NOT "overlapApproved");

ALTER TABLE "Outing" ADD CONSTRAINT "Outing_return_after_departure"
  CHECK ("returnAt" IS NULL OR "returnAt" > "departureAt");

ALTER TABLE "Outing" ADD CONSTRAINT "Outing_distance_non_negative"
  CHECK ("distanceKm" IS NULL OR "distanceKm" >= 0);

-- Une sortie terminée a obligatoirement une heure de retour et une distance ;
-- une sortie en cours n'a ni retour ni distance.
ALTER TABLE "Outing" ADD CONSTRAINT "Outing_status_consistency"
  CHECK (
    ("status" = 'IN_PROGRESS' AND "returnAt" IS NULL AND "distanceKm" IS NULL)
    OR ("status" = 'COMPLETED' AND "returnAt" IS NOT NULL AND "distanceKm" IS NOT NULL)
    OR ("status" = 'CANCELLED')
  );

ALTER TABLE "Boat" ADD CONSTRAINT "Boat_capacity_valid"
  CHECK ("rowingCapacity" BETWEEN 1 AND 8 AND "coxswainCapacity" BETWEEN 0 AND 1);
