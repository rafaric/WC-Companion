import type { SportsDataProvider } from './sports-data.types';
import { SPORTS_DATA_PROVIDER_KEYS, type SportsDataProviderKey } from './sports-data.constants';
import { FootballDataClient } from './football-data.client';
import type {
  FootballDataClientLike,
  FootballDataMatchApi,
  FootballDataProviderResolvedTournament,
  FootballDataTournamentConfigMap,
  FootballDataTeamApi,
} from './football-data.types';
import type { SportsDataFinalResultDTO, SportsDataFixtureDTO, SportsDataTeamDTO, SportsDataVenueDTO } from './sports-data.types';

const FOOTBALL_DATA_STAGE_NAME_ALIASES = {
  GROUP_STAGE: 'Group Stage',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINALS: 'Quarterfinals',
  SEMI_FINALS: 'Semifinals',
  THIRD_PLACE: 'Third Place Match',
  FINAL: 'Final',
} as const;

function formatShortName(team: FootballDataTeamApi): string {
  const trimmedTla = team.tla?.trim();
  if (trimmedTla) {
    return trimmedTla.toUpperCase();
  }

  const compactName = team.name
    .split(/\s+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');

  const fallback = team.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3);

  return (compactName.length >= 3 ? compactName : fallback).toUpperCase();
}

function normalizeFootballDataIdentifier(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function normalizeFootballDataStageName(stage: string | null): string | null {
  const normalizedStage = normalizeFootballDataIdentifier(stage);
  if (normalizedStage === null) {
    return null;
  }

  const lookupKey = normalizedStage.toUpperCase().replace(/[\s-]+/g, '_');
  return FOOTBALL_DATA_STAGE_NAME_ALIASES[lookupKey as keyof typeof FOOTBALL_DATA_STAGE_NAME_ALIASES] ?? normalizedStage;
}

export function normalizeFootballDataGroupName(groupName: string | null): string | null {
  const normalizedGroup = normalizeFootballDataIdentifier(groupName);
  if (normalizedGroup === null) {
    return null;
  }

  const lookupValue = normalizedGroup.toUpperCase().replace(/[\s_-]+/g, ' ');
  const groupMatch = lookupValue.match(/^GROUP\s+([A-Z0-9]+)$/);

  if (groupMatch !== null) {
    return `Group ${groupMatch[1]}`;
  }

  if (/^[A-Z0-9]+$/.test(lookupValue)) {
    return `Group ${lookupValue}`;
  }

  return normalizedGroup.replace(/^group\s+/i, 'Group ');
}

function parseFootballDataDate(utcDate: string): Date {
  const parsedDate = new Date(utcDate);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid football-data utcDate: ${utcDate}`);
  }

  return parsedDate;
}

function toExternalId(id: number): string {
  return String(id);
}

function requireTournamentConfig(
  tournamentConfigs: FootballDataTournamentConfigMap,
  tournamentSlug: string,
): FootballDataProviderResolvedTournament {
  const config = tournamentConfigs[tournamentSlug];

  if (config === undefined) {
    throw new Error(`No football-data tournament configuration found for tournament slug ${tournamentSlug}`);
  }

  return { tournamentSlug, config };
}

function mapTeam(team: FootballDataTeamApi): SportsDataTeamDTO {
  const countryCode = normalizeFootballDataIdentifier(team.area.code);

  return {
    externalId: toExternalId(team.id),
    name: team.name,
    shortName: formatShortName(team),
    countryCode,
    flagCode: countryCode,
    primaryColor: null,
    secondaryColor: null,
  };
}

function mapFixture(match: FootballDataMatchApi): SportsDataFixtureDTO {
  return {
    externalId: toExternalId(match.id),
    homeTeamExternalId: toExternalId(match.homeTeam.id ?? match.id),
    awayTeamExternalId: toExternalId(match.awayTeam.id ?? match.id),
    venueExternalId: null,
    kickoffAt: parseFootballDataDate(match.utcDate),
    stage: normalizeFootballDataStageName(match.stage),
    groupName: normalizeFootballDataGroupName(match.group),
  };
}

function requireFinalScore(match: FootballDataMatchApi): { homeScore: number; awayScore: number } {
  const homeScore = match.score.fullTime?.home;
  const awayScore = match.score.fullTime?.away;

  if (typeof homeScore !== 'number' || typeof awayScore !== 'number') {
    throw new Error(`football-data match ${match.id} is missing final score data`);
  }

  return { homeScore, awayScore };
}

function mapFinalResult(match: FootballDataMatchApi): SportsDataFinalResultDTO {
  const scores = requireFinalScore(match);

  return {
    externalMatchId: toExternalId(match.id),
    homeScore: scores.homeScore,
    awayScore: scores.awayScore,
    playedAt: parseFootballDataDate(match.utcDate),
  };
}

export class FootballDataProvider implements SportsDataProvider {
  readonly providerKey: SportsDataProviderKey = SPORTS_DATA_PROVIDER_KEYS.FOOTBALL_DATA;

  constructor(
    private readonly client: FootballDataClientLike = new FootballDataClient(),
    private readonly tournamentConfigs: FootballDataTournamentConfigMap = {},
  ) {}

  async listTeams(tournamentSlug: string): Promise<readonly SportsDataTeamDTO[]> {
    const resolvedTournament = requireTournamentConfig(this.tournamentConfigs, tournamentSlug);
    const response = await this.client.listTeams(resolvedTournament.config);

    return response.teams.map(mapTeam);
  }

  async listVenues(_tournamentSlug: string): Promise<readonly SportsDataVenueDTO[]> {
    // football-data.org free-tier coverage is not wired to a reliable venue import yet.
    // Keep this empty so the staging-first sync flow remains safe by default.
    return [];
  }

  async listFixtures(tournamentSlug: string): Promise<readonly SportsDataFixtureDTO[]> {
    const resolvedTournament = requireTournamentConfig(this.tournamentConfigs, tournamentSlug);
    const response = await this.client.listMatches(resolvedTournament.config);

    return response.matches.map(mapFixture);
  }

  async listFinalResults(tournamentSlug: string): Promise<readonly SportsDataFinalResultDTO[]> {
    const resolvedTournament = requireTournamentConfig(this.tournamentConfigs, tournamentSlug);
    const response = await this.client.listMatches(resolvedTournament.config);

    return response.matches.filter((match) => match.status === 'FINISHED').map(mapFinalResult);
  }
}
