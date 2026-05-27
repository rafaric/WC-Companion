import type {
  SportsDataProviderKey,
  SportsDataSyncStatus,
  SportsDataSyncType,
} from './sports-data.constants';

export interface SportsDataTeamDTO {
  externalId: string;
  name: string;
  shortName: string;
  countryCode: string | null;
  flagCode: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  crestUrl: string | null;
}

export interface SportsDataVenueDTO {
  externalId: string;
  name: string;
  city: string | null;
  countryCode: string | null;
  capacity: number | null;
}

export interface SportsDataFixtureDTO {
  externalId: string;
  homeTeamExternalId: string;
  awayTeamExternalId: string;
  venueExternalId: string | null;
  kickoffAt: Date;
  stage: string | null;
  groupName: string | null;
}

export interface SportsDataFinalResultDTO {
  externalMatchId: string;
  homeScore: number;
  awayScore: number;
  playedAt: Date | null;
}

export interface SportsDataProvider {
  readonly providerKey: SportsDataProviderKey;

  listTeams(tournamentId: string): Promise<readonly SportsDataTeamDTO[]>;
  listVenues(tournamentId: string): Promise<readonly SportsDataVenueDTO[]>;
  listFixtures(tournamentId: string): Promise<readonly SportsDataFixtureDTO[]>;
  listFinalResults(tournamentId: string): Promise<readonly SportsDataFinalResultDTO[]>;
}

export interface SportsDataSyncSummary {
  syncRunId: string;
  providerKey: string;
  tournamentId: string;
  syncType: SportsDataSyncType;
  status: SportsDataSyncStatus;
  importedCount: number;
  updatedCount: number;
  stagedCount: number;
  skippedCount: number;
  errorMessage: string | null;
}
