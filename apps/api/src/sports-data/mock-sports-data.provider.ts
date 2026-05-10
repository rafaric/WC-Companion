import { SPORTS_DATA_PROVIDER_KEYS, type SportsDataProviderKey } from './sports-data.constants';
import type {
  SportsDataFinalResultDTO,
  SportsDataFixtureDTO,
  SportsDataProvider,
  SportsDataTeamDTO,
  SportsDataVenueDTO,
} from './sports-data.types';

export interface MockSportsDataProviderSnapshot {
  teams: readonly SportsDataTeamDTO[];
  venues: readonly SportsDataVenueDTO[];
  fixtures: readonly SportsDataFixtureDTO[];
  finalResults: readonly SportsDataFinalResultDTO[];
}

export const MOCK_SPORTS_DATA_PROVIDER_SNAPSHOT: MockSportsDataProviderSnapshot = {
  teams: [
    {
      externalId: 'team-argentina',
      name: 'Argentina',
      shortName: 'ARG',
      countryCode: 'AR',
      flagCode: 'ARG',
      primaryColor: '#74ACDF',
      secondaryColor: '#F6E7A1',
    },
    {
      externalId: 'team-england',
      name: 'England',
      shortName: 'ENG',
      countryCode: 'GB-ENG',
      flagCode: 'ENG',
      primaryColor: '#FFFFFF',
      secondaryColor: '#CE1124',
    },
    {
      externalId: 'team-brazil',
      name: 'Brazil',
      shortName: 'BRA',
      countryCode: 'BR',
      flagCode: 'BRA',
      primaryColor: '#009C3B',
      secondaryColor: '#FFDF00',
    },
    {
      externalId: 'team-germany',
      name: 'Germany',
      shortName: 'GER',
      countryCode: 'DE',
      flagCode: 'GER',
      primaryColor: '#000000',
      secondaryColor: '#DD0000',
    },
  ],
  venues: [
    {
      externalId: 'venue-mexico-city',
      name: 'Estadio Azteca',
      city: 'Mexico City',
      countryCode: 'MX',
      capacity: 87523,
    },
    {
      externalId: 'venue-los-angeles',
      name: 'Rose Bowl',
      city: 'Los Angeles',
      countryCode: 'US',
      capacity: 92542,
    },
  ],
  fixtures: [
    {
      externalId: 'fixture-arg-eng',
      homeTeamExternalId: 'team-argentina',
      awayTeamExternalId: 'team-england',
      venueExternalId: 'venue-mexico-city',
      kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
      stage: 'Group Stage',
      groupName: 'Group A',
    },
    {
      externalId: 'fixture-bra-ger',
      homeTeamExternalId: 'team-brazil',
      awayTeamExternalId: 'team-germany',
      venueExternalId: 'venue-los-angeles',
      kickoffAt: new Date('2026-06-12T16:00:00.000Z'),
      stage: 'Group Stage',
      groupName: 'Group B',
    },
  ],
  finalResults: [],
};

export class MockSportsDataProvider implements SportsDataProvider {
  readonly providerKey: SportsDataProviderKey = SPORTS_DATA_PROVIDER_KEYS.MOCK;

  constructor(private readonly snapshot: MockSportsDataProviderSnapshot = MOCK_SPORTS_DATA_PROVIDER_SNAPSHOT) {}

  async listTeams(_tournamentId: string): Promise<readonly SportsDataTeamDTO[]> {
    return this.snapshot.teams;
  }

  async listVenues(_tournamentId: string): Promise<readonly SportsDataVenueDTO[]> {
    return this.snapshot.venues;
  }

  async listFixtures(_tournamentId: string): Promise<readonly SportsDataFixtureDTO[]> {
    return this.snapshot.fixtures;
  }

  async listFinalResults(_tournamentId: string): Promise<readonly SportsDataFinalResultDTO[]> {
    return this.snapshot.finalResults;
  }
}
