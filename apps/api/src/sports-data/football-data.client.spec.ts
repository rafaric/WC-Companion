import { FootballDataClient } from './football-data.client';

describe('FootballDataClient', () => {
  it('builds competition paths using the numeric competition id and season', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ count: 0, competition: {}, season: {}, teams: [] }),
    })) as unknown as typeof fetch;

    const client = new FootballDataClient({
      apiToken: 'token-1',
      fetchImpl,
    });

    await client.listTeams({
      competitionId: 2000,
      season: 2026,
      displayName: 'World Cup 2026 Demo',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.football-data.org/v4/competitions/2000/teams?season=2026',
      {
        headers: {
          Accept: 'application/json',
          'X-Auth-Token': 'token-1',
        },
      },
    );
  });
});
