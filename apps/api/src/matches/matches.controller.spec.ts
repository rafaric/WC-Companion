import { FinalizeMatchDto } from './dto/finalize-match.dto';
import { MatchesController } from './matches.controller';
import type { FinalizeMatchSummary, MatchesService } from './matches.service';

describe('MatchesController', () => {
  it('delegates finalization to the service', async () => {
    const summary: FinalizeMatchSummary = {
      matchId: 'match-1',
      tournamentId: 'tournament-1',
      scoringSummary: {
        matchId: 'match-1',
        tournamentId: 'tournament-1',
        scoringRuleId: 'rule-1',
        pendingCount: 2,
        processedCount: 2,
        alreadyScoredCount: 0,
        scoredAt: new Date('2026-05-08T12:00:00.000Z'),
      },
      globalRankingSummary: {
        scope: 'GLOBAL',
        scopeId: 'global',
        tournamentId: 'tournament-1',
        processedCount: 2,
      },
      groupRankingSummaries: [],
    };

    const matchesService = {
      finalizeMatch: jest.fn(async () => summary),
    } as unknown as MatchesService;
    const controller = new MatchesController(matchesService);
    const body: FinalizeMatchDto = {
      homeScore: 2,
      awayScore: 1,
    };

    await expect(controller.finalizeMatch('match-1', body)).resolves.toEqual(summary);
    expect(matchesService.finalizeMatch).toHaveBeenCalledWith({
      matchId: 'match-1',
      homeScore: 2,
      awayScore: 1,
    });
  });
});
