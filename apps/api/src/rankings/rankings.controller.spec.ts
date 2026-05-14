import { RankingsController } from './rankings.controller';
import type { RankingEntryView, RankingsService } from './rankings.service';

describe('RankingsController', () => {
  it('delegates the global ranking lookup to the service with tournament context', async () => {
    const ranking: RankingEntryView[] = [
      {
        position: 1,
        userId: 'user-1',
        username: 'messi',
        avatar: null,
        country: 'AR',
        favoriteTeamId: 'team-1',
        totalPoints: 12,
        exactPredictions: 4,
        predictionsCount: 4,
        lastScoredAt: null,
        updatedAt: new Date('2026-05-08T00:00:00.000Z'),
      },
    ];

    const rankingsService = {
      getActiveGlobalRanking: jest.fn(async () => ranking),
    } as unknown as RankingsService;
    const controller = new RankingsController(rankingsService);

    await expect(controller.getGlobalRanking({} as { tournamentId: string | null; tournamentSlug: string | null })).resolves.toEqual(ranking);
    expect(rankingsService.getActiveGlobalRanking).toHaveBeenCalledTimes(1);
    expect(rankingsService.getActiveGlobalRanking).toHaveBeenCalledWith({
      tournamentContext: {
        explicitTournamentId: undefined,
        selectedSlug: undefined,
      },
    });
  });

  it('passes explicit tournamentId from query to the service', async () => {
    const ranking: RankingEntryView[] = [];

    const rankingsService = {
      getActiveGlobalRanking: jest.fn(async () => ranking),
    } as unknown as RankingsService;
    const controller = new RankingsController(rankingsService);

    await expect(controller.getGlobalRanking({ tournamentId: 'tournament-123', tournamentSlug: null })).resolves.toEqual(ranking);
    expect(rankingsService.getActiveGlobalRanking).toHaveBeenCalledWith({
      tournamentContext: {
        explicitTournamentId: 'tournament-123',
        selectedSlug: null,
      },
    });
  });
});
