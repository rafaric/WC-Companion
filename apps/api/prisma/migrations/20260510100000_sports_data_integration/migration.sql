-- CreateEnum
CREATE TYPE "ExternalSyncType" AS ENUM ('IMPORT', 'RESULTS');

-- CreateEnum
CREATE TYPE "ExternalSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ExternalMatchResultState" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'DISCARDED');

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "countryCode" TEXT,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalTeamReference" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalTeamReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalVenueReference" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalVenueReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalMatchReference" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalMatchReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSyncRun" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "syncType" "ExternalSyncType" NOT NULL,
    "status" "ExternalSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "cursor" TEXT,
    "nextCursor" TEXT,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "stagedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalMatchResult" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "externalMatchId" TEXT NOT NULL,
    "matchId" TEXT,
    "externalSyncRunId" TEXT,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3),
    "state" "ExternalMatchResultState" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "stagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalMatchResult_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "venueId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Venue_tournamentId_name_key" ON "Venue"("tournamentId", "name");

-- CreateIndex
CREATE INDEX "Venue_tournamentId_idx" ON "Venue"("tournamentId");

-- CreateIndex
CREATE INDEX "Venue_countryCode_idx" ON "Venue"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTeamReference_providerKey_externalId_key" ON "ExternalTeamReference"("providerKey", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTeamReference_providerKey_tournamentId_teamId_key" ON "ExternalTeamReference"("providerKey", "tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "ExternalTeamReference_tournamentId_idx" ON "ExternalTeamReference"("tournamentId");

-- CreateIndex
CREATE INDEX "ExternalTeamReference_teamId_idx" ON "ExternalTeamReference"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalVenueReference_providerKey_externalId_key" ON "ExternalVenueReference"("providerKey", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalVenueReference_providerKey_tournamentId_venueId_key" ON "ExternalVenueReference"("providerKey", "tournamentId", "venueId");

-- CreateIndex
CREATE INDEX "ExternalVenueReference_tournamentId_idx" ON "ExternalVenueReference"("tournamentId");

-- CreateIndex
CREATE INDEX "ExternalVenueReference_venueId_idx" ON "ExternalVenueReference"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalMatchReference_providerKey_externalId_key" ON "ExternalMatchReference"("providerKey", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalMatchReference_providerKey_tournamentId_matchId_key" ON "ExternalMatchReference"("providerKey", "tournamentId", "matchId");

-- CreateIndex
CREATE INDEX "ExternalMatchReference_tournamentId_idx" ON "ExternalMatchReference"("tournamentId");

-- CreateIndex
CREATE INDEX "ExternalMatchReference_matchId_idx" ON "ExternalMatchReference"("matchId");

-- CreateIndex
CREATE INDEX "ExternalSyncRun_providerKey_tournamentId_syncType_startedAt_idx" ON "ExternalSyncRun"("providerKey", "tournamentId", "syncType", "startedAt");

-- CreateIndex
CREATE INDEX "ExternalSyncRun_status_idx" ON "ExternalSyncRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalMatchResult_providerKey_externalMatchId_key" ON "ExternalMatchResult"("providerKey", "externalMatchId");

-- CreateIndex
CREATE INDEX "ExternalMatchResult_tournamentId_state_idx" ON "ExternalMatchResult"("tournamentId", "state");

-- CreateIndex
CREATE INDEX "ExternalMatchResult_matchId_idx" ON "ExternalMatchResult"("matchId");

-- CreateIndex
CREATE INDEX "ExternalMatchResult_externalSyncRunId_idx" ON "ExternalMatchResult"("externalSyncRunId");

-- CreateIndex
CREATE INDEX "Match_venueId_idx" ON "Match"("venueId");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTeamReference" ADD CONSTRAINT "ExternalTeamReference_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalTeamReference" ADD CONSTRAINT "ExternalTeamReference_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalVenueReference" ADD CONSTRAINT "ExternalVenueReference_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalVenueReference" ADD CONSTRAINT "ExternalVenueReference_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalMatchReference" ADD CONSTRAINT "ExternalMatchReference_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalMatchReference" ADD CONSTRAINT "ExternalMatchReference_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSyncRun" ADD CONSTRAINT "ExternalSyncRun_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalMatchResult" ADD CONSTRAINT "ExternalMatchResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalMatchResult" ADD CONSTRAINT "ExternalMatchResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalMatchResult" ADD CONSTRAINT "ExternalMatchResult_externalSyncRunId_fkey" FOREIGN KEY ("externalSyncRunId") REFERENCES "ExternalSyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
