import type { SportsDataProviderKey } from './sports-data.constants';

export const FOOTBALL_DATA_MATCH_STATUSES = {
  SCHEDULED: 'SCHEDULED',
  TIMED: 'TIMED',
  IN_PLAY: 'IN_PLAY',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
  POSTPONED: 'POSTPONED',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
  AWARDED: 'AWARDED',
} as const;

export type FootballDataMatchStatus = (typeof FOOTBALL_DATA_MATCH_STATUSES)[keyof typeof FOOTBALL_DATA_MATCH_STATUSES];

export interface FootballDataTournamentConfig {
  competitionId: number;
  season: number | null;
  displayName: string;
}

export type FootballDataTournamentConfigMap = Readonly<Record<string, FootballDataTournamentConfig>>;

export interface FootballDataClientOptions {
  baseUrl?: string;
  apiToken?: string;
  fetchImpl?: typeof fetch;
}

export interface FootballDataAreaApi {
  code: string | null;
  name: string;
}

export interface FootballDataTeamApi {
  id: number;
  name: string;
  tla: string | null;
  area: FootballDataAreaApi;
}

export interface FootballDataTeamCollectionResponse {
  count: number;
  competition: FootballDataCompetitionApi;
  season: FootballDataSeasonApi;
  teams: readonly FootballDataTeamApi[];
}

export interface FootballDataVenueApi {
  id: number | null;
  name: string | null;
  city: string | null;
  capacity: number | null;
}

export interface FootballDataScoreApi {
  winner: string | null;
  duration: string | null;
  fullTime: FootballDataScoreValueApi | null;
  halfTime: FootballDataScoreValueApi | null;
  extraTime: FootballDataScoreValueApi | null;
  penalties: FootballDataScoreValueApi | null;
}

export interface FootballDataScoreValueApi {
  home: number | null;
  away: number | null;
}

export interface FootballDataMatchTeamApi {
  id: number | null;
  name: string;
  tla: string | null;
}

export interface FootballDataCompetitionApi {
  id: number;
  code: string;
  name: string;
  type: string;
  emblem: string | null;
}

export interface FootballDataSeasonApi {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number | null;
  winner: unknown | null;
}

export interface FootballDataMatchApi {
  id: number;
  utcDate: string;
  status: FootballDataMatchStatus;
  stage: string | null;
  group: string | null;
  venue: FootballDataVenueApi | null;
  homeTeam: FootballDataMatchTeamApi;
  awayTeam: FootballDataMatchTeamApi;
  score: FootballDataScoreApi;
}

export interface FootballDataMatchCollectionResponse {
  count: number;
  competition: FootballDataCompetitionApi;
  filters: Readonly<Record<string, string | number | boolean | null>>;
  matches: readonly FootballDataMatchApi[];
}

export interface FootballDataClientLike {
  listTeams(tournamentConfig: FootballDataTournamentConfig): Promise<FootballDataTeamCollectionResponse>;
  listMatches(tournamentConfig: FootballDataTournamentConfig): Promise<FootballDataMatchCollectionResponse>;
}

export interface FootballDataProviderResolvedTournament {
  tournamentSlug: string;
  config: FootballDataTournamentConfig;
}

export interface FootballDataProviderMetadata {
  providerKey: SportsDataProviderKey;
  baseUrl: string;
}
