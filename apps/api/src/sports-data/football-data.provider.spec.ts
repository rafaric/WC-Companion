import { SPORTS_DATA_PROVIDER_KEYS } from './sports-data.constants';
import { FootballDataProvider, normalizeFootballDataGroupName, normalizeFootballDataStageName } from './football-data.provider';
import type { FootballDataClientLike, FootballDataMatchCollectionResponse, FootballDataTeamCollectionResponse } from './football-data.types';

function createClientMock(): jest.Mocked<FootballDataClientLike> {
  return {
    listTeams: jest.fn(),
    listMatches: jest.fn(),
  };
}

describe('FootballDataProvider', () => {
  const tournamentConfigs = {
    'world-cup-2026-demo': {
      competitionId: 2000,
      season: 2026,
      displayName: 'World Cup 2026',
    },
  } as const;

  it('exposes the football-data provider key', () => {
    const provider = new FootballDataProvider(createClientMock(), tournamentConfigs);

    expect(provider.providerKey).toBe(SPORTS_DATA_PROVIDER_KEYS.FOOTBALL_DATA);
  });

  it('maps teams from the raw football-data response', async () => {
    const client = createClientMock();
    const response: FootballDataTeamCollectionResponse = {
      count: 2,
      competition: {
        id: 1,
        code: 'WC',
        name: 'World Cup',
        type: 'CUP',
        emblem: null,
      },
      season: {
        id: 2026,
        startDate: '2026-06-01',
        endDate: '2026-07-01',
        currentMatchday: 1,
        winner: null,
      },
      teams: [
        {
          id: 10,
          name: 'Argentina',
          tla: 'ARG',
          area: {
            code: 'AR',
            name: 'Argentina',
          },
        },
        {
          id: 11,
          name: 'England',
          tla: null,
          area: {
            code: 'GB-ENG',
            name: 'England',
          },
        },
      ],
    };

    client.listTeams.mockResolvedValue(response);

    const provider = new FootballDataProvider(client, tournamentConfigs);

    await expect(provider.listTeams('world-cup-2026-demo')).resolves.toEqual([
      {
        externalId: '10',
        name: 'Argentina',
        shortName: 'ARG',
        countryCode: 'AR',
        flagCode: 'AR',
        primaryColor: null,
        secondaryColor: null,
        crestUrl: null,
      },
      {
        externalId: '11',
        name: 'England',
        shortName: 'ENG',
        countryCode: 'GB-ENG',
        flagCode: 'GB-ENG',
        primaryColor: null,
        secondaryColor: null,
        crestUrl: null,
      },
    ]);

    expect(client.listTeams).toHaveBeenCalledWith(tournamentConfigs['world-cup-2026-demo']);
  });

  it('maps fixtures and normalizes stage and group names while skipping unresolved knockout placeholders', async () => {
    const client = createClientMock();
    const response: FootballDataMatchCollectionResponse = {
      count: 2,
      competition: {
        id: 1,
        code: 'WC',
        name: 'World Cup',
        type: 'CUP',
        emblem: null,
      },
      filters: {},
      matches: [
        {
          id: 1001,
          utcDate: '2026-06-11T16:00:00.000Z',
          status: 'SCHEDULED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          venue: null,
          homeTeam: { id: 10, name: 'Argentina', tla: 'ARG' },
          awayTeam: { id: 11, name: 'England', tla: 'ENG' },
          score: {
            winner: null,
            duration: null,
            fullTime: null,
            halfTime: null,
            extraTime: null,
            penalties: null,
          },
        },
        {
          id: 1002,
          utcDate: '2026-06-12T16:00:00.000Z',
          status: 'TIMED',
          stage: 'ROUND_OF_16',
          group: null,
          venue: null,
          homeTeam: { id: 12, name: 'Brazil', tla: 'BRA' },
          awayTeam: { id: 13, name: 'Germany', tla: 'GER' },
          score: {
            winner: null,
            duration: null,
            fullTime: null,
            halfTime: null,
            extraTime: null,
            penalties: null,
          },
        },
        {
          id: 537417,
          utcDate: '2026-06-28T19:00:00.000Z',
          status: 'TIMED',
          stage: 'LAST_32',
          group: null,
          venue: null,
          homeTeam: { id: null, name: 'TBD', tla: null },
          awayTeam: { id: null, name: 'TBD', tla: null },
          score: {
            winner: null,
            duration: null,
            fullTime: null,
            halfTime: null,
            extraTime: null,
            penalties: null,
          },
        },
      ],
    };

    client.listMatches.mockResolvedValue(response);

    const provider = new FootballDataProvider(client, tournamentConfigs);

    await expect(provider.listFixtures('world-cup-2026-demo')).resolves.toEqual([
      {
        externalId: '1001',
        homeTeamExternalId: '10',
        awayTeamExternalId: '11',
        venueExternalId: null,
        kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
        stage: 'Group Stage',
        groupName: 'Group A',
      },
      {
        externalId: '1002',
        homeTeamExternalId: '12',
        awayTeamExternalId: '13',
        venueExternalId: null,
        kickoffAt: new Date('2026-06-12T16:00:00.000Z'),
        stage: 'Round of 16',
        groupName: null,
      },
    ]);

    expect(normalizeFootballDataStageName('GROUP_STAGE')).toBe('Group Stage');
    expect(normalizeFootballDataGroupName('GROUP_B')).toBe('Group B');
  });

  it('returns no venues until venue ingestion exists', async () => {
    const provider = new FootballDataProvider(createClientMock(), tournamentConfigs);

    await expect(provider.listVenues('world-cup-2026-demo')).resolves.toEqual([]);
  });

  it('maps only finished matches to final results', async () => {
    const client = createClientMock();
    const response: FootballDataMatchCollectionResponse = {
      count: 2,
      competition: {
        id: 1,
        code: 'WC',
        name: 'World Cup',
        type: 'CUP',
        emblem: null,
      },
      filters: {},
      matches: [
        {
          id: 2001,
          utcDate: '2026-06-11T18:30:00.000Z',
          status: 'FINISHED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          venue: null,
          homeTeam: { id: 10, name: 'Argentina', tla: 'ARG' },
          awayTeam: { id: 11, name: 'England', tla: 'ENG' },
          score: {
            winner: 'HOME_TEAM',
            duration: 'REGULAR',
            fullTime: { home: 2, away: 1 },
            halfTime: { home: 1, away: 0 },
            extraTime: { home: null, away: null },
            penalties: { home: null, away: null },
          },
        },
        {
          id: 2002,
          utcDate: '2026-06-12T16:00:00.000Z',
          status: 'TIMED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_B',
          venue: null,
          homeTeam: { id: 12, name: 'Brazil', tla: 'BRA' },
          awayTeam: { id: 13, name: 'Germany', tla: 'GER' },
          score: {
            winner: null,
            duration: null,
            fullTime: null,
            halfTime: null,
            extraTime: null,
            penalties: null,
          },
        },
      ],
    };

    client.listMatches.mockResolvedValue(response);

    const provider = new FootballDataProvider(client, tournamentConfigs);

    await expect(provider.listFinalResults('world-cup-2026-demo')).resolves.toEqual([
      {
        externalMatchId: '2001',
        homeScore: 2,
        awayScore: 1,
        playedAt: new Date('2026-06-11T18:30:00.000Z'),
      },
    ]);
  });

  it('throws when the tournament slug is not configured', async () => {
    const provider = new FootballDataProvider(createClientMock(), tournamentConfigs);

    await expect(provider.listTeams('tournament-1')).rejects.toThrow(
      'No football-data tournament configuration found for tournament slug tournament-1',
    );
  });
});
