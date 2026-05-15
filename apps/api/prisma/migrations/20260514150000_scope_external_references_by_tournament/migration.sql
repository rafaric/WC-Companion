-- Drop the old global uniqueness constraints that caused cross-tournament pollution
DROP INDEX "ExternalTeamReference_providerKey_externalId_key";
DROP INDEX "ExternalVenueReference_providerKey_externalId_key";
DROP INDEX "ExternalMatchReference_providerKey_externalId_key";
DROP INDEX "ExternalMatchResult_providerKey_externalMatchId_key";

-- Add tournament-scoped uniqueness: a provider's external ID is unique within each tournament
CREATE UNIQUE INDEX "ExternalTeamReference_providerKey_tournamentId_externalId_key" ON "ExternalTeamReference"("providerKey", "tournamentId", "externalId");
CREATE UNIQUE INDEX "ExternalVenueReference_providerKey_tournamentId_externalId_key" ON "ExternalVenueReference"("providerKey", "tournamentId", "externalId");
CREATE UNIQUE INDEX "ExternalMatchReference_providerKey_tournamentId_externalId_key" ON "ExternalMatchReference"("providerKey", "tournamentId", "externalId");
CREATE UNIQUE INDEX "ExternalMatchResult_providerKey_tournamentId_externalMatchId_key" ON "ExternalMatchResult"("providerKey", "tournamentId", "externalMatchId");