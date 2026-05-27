import { NotFoundException } from '@nestjs/common';

import { SPORTS_DATA_PROVIDER_KEYS } from './sports-data.constants';
import { ApiSportsProvider } from './api-sports.provider';
import type {
  ApiSportsClientLike,
  ApiSportsTournamentConfigMap,
} from './api-sports.types';
import type {
  ApiSportsTeamCollectionResponse,
  ApiSportsFixtureCollectionResponse,
} from './api-sports.types';

function createClientMock(): jest.Mocked<ApiSportsClientLike> {
  return {
    listTeams: jest.fn(),
    listFixtures: jest.fn(),
  };
}

function createTournamentConfigs(): ApiSportsTournamentConfigMap {
  return {
    'liga-argentina-2026': {
      leagueId: 128,
      season: 2026,
      displayName: 'Liga Profesional Argentina 2026',
    },
  } as const satisfies ApiSportsTournamentConfigMap;
}

function validFixture(overrides?: Partial<ApiSportsFixtureCollectionResponse['response'][number]>): ApiSportsFixtureCollectionResponse['response'][number] {
  return {
    fixture: { id: 1000, date: '2026-03-15T20:00:00+00:00', status: { short: 'NS' }, venue: { id: 10, name: 'Estadio Monumental', city: 'Buenos Aires' } },
    league: { round: 'Regular Season - 10' },
    teams: { home: { id: 500, name: 'River Plate', code: 'RIV' }, away: { id: 501, name: 'Boca Juniors', code: 'BOC' } },
    goals: { home: null, away: null },
    ...overrides,
  };
}

describe('ApiSportsProvider', () => {
  describe('provider key', () => {
    it('exposes the api-sports provider key', () => {
      const provider = new ApiSportsProvider(createClientMock(), createTournamentConfigs());

      expect(provider.providerKey).toBe(SPORTS_DATA_PROVIDER_KEYS.API_SPORTS);
    });
  });

  describe('listTeams', () => {
    it('maps teams from raw api-sports response', async () => {
      const client = createClientMock();
      const response: ApiSportsTeamCollectionResponse = {
        response: [
          { team: { id: 500, name: 'River Plate', code: 'RIV', country: 'Argentina' } },
          { team: { id: 501, name: 'Boca Juniors', code: 'BOC', country: 'Argentina' } },
        ],
      };

      client.listTeams.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      await expect(provider.listTeams('liga-argentina-2026')).resolves.toEqual([
        {
          externalId: '500',
          name: 'River Plate',
          shortName: 'RIV',
          countryCode: null,
          flagCode: null,
          primaryColor: null,
          secondaryColor: null,
          crestUrl: null,
        },
        {
          externalId: '501',
          name: 'Boca Juniors',
          shortName: 'BOC',
          countryCode: null,
          flagCode: null,
          primaryColor: null,
          secondaryColor: null,
          crestUrl: null,
        },
      ]);
    });

    it('falls back to acronym when team.code is missing', async () => {
      const client = createClientMock();
      const response: ApiSportsTeamCollectionResponse = {
        response: [
          { team: { id: 502, name: 'Club Atlético Banfield', code: null, country: 'Argentina' } },
        ],
      };

      client.listTeams.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      const result = await provider.listTeams('liga-argentina-2026');

      expect(result).toHaveLength(1);
      expect(result[0]!.shortName).toBe('CAB');
    });

    it('falls back to short acronym when team.code is absent and acronym length < 3', async () => {
      const client = createClientMock();
      const response: ApiSportsTeamCollectionResponse = {
        response: [
          { team: { id: 503, name: 'Argentinos Juniors', code: null, country: 'Argentina' } },
        ],
      };

      client.listTeams.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      const result = await provider.listTeams('liga-argentina-2026');

      expect(result).toHaveLength(1);
      // buildAcronym('Argentinos Juniors') = 'AJ' (2 chars < 3), falls back to sanitized first 3: 'ARG'
      expect(result[0]!.shortName).toBe('ARG');
    });

    it('throws for unknown tournament slug', async () => {
      const client = createClientMock();
      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      await expect(provider.listTeams('world-cup-2026')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listFixtures', () => {
    it('maps fixtures with team ids, venue ids, kickoff time, and round label', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          validFixture(),
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      const result = await provider.listFixtures('liga-argentina-2026');

      expect(result).toEqual([
        {
          externalId: '1000',
          homeTeamExternalId: '500',
          awayTeamExternalId: '501',
          venueExternalId: '10',
          kickoffAt: expect.any(Date),
          stage: 'Regular Season - 10',
          groupName: null,
        },
      ]);
    });

    it('skips fixtures missing home team id', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          validFixture({ teams: { home: { id: null as never, name: 'River Plate', code: 'RIV' }, away: { id: 501, name: 'Boca Juniors', code: 'BOC' } } }),
          validFixture({ fixture: { id: 1001, date: '2026-03-16T20:00:00+00:00', status: { short: 'NS' }, venue: { id: 10, name: 'Estadio Monumental', city: 'Buenos Aires' } } }),
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      const result = await provider.listFixtures('liga-argentina-2026');

      expect(result).toHaveLength(1);
      expect(result[0]!.externalId).toBe('1001');
    });

    it('skips fixtures missing away team id', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          validFixture({ teams: { home: { id: 500, name: 'River Plate', code: 'RIV' }, away: { id: null as never, name: 'Boca Juniors', code: 'BOC' } } }),
          validFixture({ fixture: { id: 1002, date: '2026-03-17T20:00:00+00:00', status: { short: 'NS' }, venue: { id: 11, name: 'La Bombonera', city: 'Buenos Aires' } } }),
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      const result = await provider.listFixtures('liga-argentina-2026');

      expect(result).toHaveLength(1);
      expect(result[0]!.externalId).toBe('1002');
    });

    it('sets venueExternalId to null when fixture venue is absent', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          validFixture({ fixture: { id: 1003, date: '2026-03-18T20:00:00+00:00', status: { short: 'NS' }, venue: null } }),
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      const result = await provider.listFixtures('liga-argentina-2026');

      expect(result).toHaveLength(1);
      expect(result[0]!.venueExternalId).toBeNull();
    });

    it('throws for fixtures with invalid kickoff date data', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          validFixture({ fixture: { id: 1004, date: 'not-a-date', status: { short: 'NS' }, venue: null } }),
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      await expect(provider.listFixtures('liga-argentina-2026')).rejects.toThrow(
        'api-sports fixture 1004 has invalid date data',
      );
    });
  });

  describe('listVenues', () => {
    function fixtureWithVenue(id: number, venueName: string, city: string): ApiSportsFixtureCollectionResponse['response'][number] {
      return {
        fixture: { id, date: '2026-03-15T20:00:00+00:00', status: { short: 'NS' }, venue: { id, name: venueName, city } },
        league: { round: 'Regular Season - 10' },
        teams: { home: { id: 500, name: 'River Plate', code: 'RIV' }, away: { id: 501, name: 'Boca Juniors', code: 'BOC' } },
        goals: { home: null, away: null },
      };
    }

    it('derives deduped venues from fixture venue payloads', async () => {
      const client = createClientMock();
      // Two fixtures share the same venue
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          fixtureWithVenue(10, 'Estadio Monumental', 'Buenos Aires'),
          fixtureWithVenue(10, 'Estadio Monumental', 'Buenos Aires'),
          fixtureWithVenue(11, 'La Bombonera', 'Buenos Aires'),
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      const result = await provider.listVenues('liga-argentina-2026');

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        externalId: '10',
        name: 'Estadio Monumental',
        city: 'Buenos Aires',
        countryCode: null,
        capacity: null,
      });
      expect(result).toContainEqual({
        externalId: '11',
        name: 'La Bombonera',
        city: 'Buenos Aires',
        countryCode: null,
        capacity: null,
      });
    });

    it('skips venues with missing or blank name', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          fixtureWithVenue(12, '', 'Buenos Aires'),
          fixtureWithVenue(13, '   ', 'Buenos Aires'),
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      const result = await provider.listVenues('liga-argentina-2026');

      expect(result).toHaveLength(0);
    });
  });

  describe('listFinalResults', () => {
    function ftFixture(id: number, homeScore: number, awayScore: number): ApiSportsFixtureCollectionResponse['response'][number] {
      return {
        fixture: { id, date: '2026-03-15T20:00:00+00:00', status: { short: 'FT' }, venue: null },
        league: { round: 'Regular Season - 10' },
        teams: { home: { id: 500, name: 'River Plate', code: 'RIV' }, away: { id: 501, name: 'Boca Juniors', code: 'BOC' } },
        goals: { home: homeScore, away: awayScore },
      };
    }

    function nonFtFixture(id: number): ApiSportsFixtureCollectionResponse['response'][number] {
      return {
        fixture: { id, date: '2026-03-16T20:00:00+00:00', status: { short: 'NS' }, venue: null },
        league: { round: 'Regular Season - 11' },
        teams: { home: { id: 500, name: 'River Plate', code: 'RIV' }, away: { id: 501, name: 'Boca Juniors', code: 'BOC' } },
        goals: { home: null, away: null },
      };
    }

    it('maps only FT fixtures to final results', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          ftFixture(1000, 2, 1),
          ftFixture(1001, 0, 0),
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      await expect(provider.listFinalResults('liga-argentina-2026')).resolves.toEqual([
        {
          externalMatchId: '1000',
          homeScore: 2,
          awayScore: 1,
          playedAt: expect.any(Date),
        },
        {
          externalMatchId: '1001',
          homeScore: 0,
          awayScore: 0,
          playedAt: expect.any(Date),
        },
      ]);
    });

    it('excludes non-FT fixtures from final results', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          ftFixture(1000, 2, 1),
          nonFtFixture(1002),
          nonFtFixture(1003),
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      const result = await provider.listFinalResults('liga-argentina-2026');

      expect(result).toHaveLength(1);
      expect(result[0]!.externalMatchId).toBe('1000');
    });

    it('throws for FT fixture with null scores', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          {
            fixture: { id: 1005, date: '2026-03-15T20:00:00+00:00', status: { short: 'FT' }, venue: null },
            league: { round: 'Regular Season - 10' },
            teams: { home: { id: 500, name: 'River Plate', code: 'RIV' }, away: { id: 501, name: 'Boca Juniors', code: 'BOC' } },
            goals: { home: null, away: 1 },
          },
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      await expect(provider.listFinalResults('liga-argentina-2026')).rejects.toThrow(
        'api-sports fixture 1005 is missing final score data',
      );
    });

    it('throws for FT fixtures with invalid playedAt date data', async () => {
      const client = createClientMock();
      const response: ApiSportsFixtureCollectionResponse = {
        response: [
          {
            fixture: { id: 1006, date: 'not-a-date', status: { short: 'FT' }, venue: null },
            league: { round: 'Regular Season - 10' },
            teams: { home: { id: 500, name: 'River Plate', code: 'RIV' }, away: { id: 501, name: 'Boca Juniors', code: 'BOC' } },
            goals: { home: 2, away: 1 },
          },
        ],
      };

      client.listFixtures.mockResolvedValue(response);

      const provider = new ApiSportsProvider(client, createTournamentConfigs());

      await expect(provider.listFinalResults('liga-argentina-2026')).rejects.toThrow(
        'api-sports fixture 1006 has invalid date data',
      );
    });
  });
});