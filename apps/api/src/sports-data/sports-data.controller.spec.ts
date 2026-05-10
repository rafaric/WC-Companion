import { AUTH_PERMISSION_METADATA_KEYS, AUTH_PERMISSIONS } from '../auth/auth.constants';
import { SportsDataController } from './sports-data.controller';
import type { ConfirmExternalMatchResultSummary, SportsDataSyncService } from './sports-data-sync.service';

describe('SportsDataController', () => {
  it('delegates manual confirmation to the service', async () => {
    const summary: ConfirmExternalMatchResultSummary = {
      externalMatchResultId: 'external-result-1',
      externalMatchId: 'fixture-arg-eng',
      matchId: 'match-1',
      tournamentId: 'tournament-1',
      state: 'CONFIRMED',
      confirmedAt: new Date('2026-05-08T12:00:00.000Z'),
      finalizationSummary: {
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
      },
    };

    const sportsDataSyncService = {
      confirmExternalMatchResult: jest.fn(async () => summary),
    } as unknown as SportsDataSyncService;
    const controller = new SportsDataController(sportsDataSyncService);

    await expect(controller.confirmExternalMatchResult('external-result-1')).resolves.toEqual(summary);
    expect(sportsDataSyncService.confirmExternalMatchResult).toHaveBeenCalledWith({
      externalMatchResultId: 'external-result-1',
    });
  });

  it('requires the matches finalize permission', () => {
    const requiredPermissions = Reflect.getMetadata(
      AUTH_PERMISSION_METADATA_KEYS.REQUIRED_PERMISSIONS,
      SportsDataController.prototype.confirmExternalMatchResult,
    ) as string[] | undefined;

    expect(requiredPermissions).toEqual([AUTH_PERMISSIONS.MATCHES_FINALIZE]);
  });
});
