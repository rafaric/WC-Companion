-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "crestUrl" TEXT;

-- RenameIndex
ALTER INDEX "ExternalMatchResult_providerKey_tournamentId_externalMatchId_ke" RENAME TO "ExternalMatchResult_providerKey_tournamentId_externalMatchI_key";
