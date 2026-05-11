import { AUTH_PERMISSION_METADATA_KEYS, AUTH_PERMISSIONS } from '../auth/auth.constants';
import { SportsDataController } from './sports-data.controller';
import type {
  ConfirmExternalMatchResultSummary,
  DiscardExternalMatchResultSummary,
  ExternalMatchResultSummary,
  SportsDataSyncService,
} from './sports-data-sync.service';

describe('SportsDataController', () => {
  it('lists pending staged results for admin review', async () => {
    const results: ExternalMatchResultSummary[] = [
      {
        id: 'external-result-1',
        providerKey: 'mock',
        externalMatchId: 'fixture-arg-eng',
        matchId: 'match-1',
        state: 'PENDING_CONFIRMATION',
        homeScore: 2,
        awayScore: 1,
        playedAt: new Date('2026-05-08T11:00:00.000Z'),
        stagedAt: new Date('2026-05-08T12:00:00.000Z'),
        confirmedAt: null,
        discardedAt: null,
        match: {
          matchId: 'match-1',
          status: 'UPCOMING',
          kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
          homeTeamName: 'Argentina',
          awayTeamName: 'England',
          stage: 'Group Stage',
          groupName: 'Group A',
        },
      },
    ];

    const sportsDataSyncService = {
      listExternalMatchResults: jest.fn(async () => results),
    } as unknown as SportsDataSyncService;
    const controller = new SportsDataController(sportsDataSyncService);

    await expect(controller.listExternalMatchResults({})).resolves.toEqual(results);
    expect(sportsDataSyncService.listExternalMatchResults).toHaveBeenCalledWith('PENDING_CONFIRMATION');
  });

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

  it('delegates manual discard to the service', async () => {
    const summary: DiscardExternalMatchResultSummary = {
      externalMatchResultId: 'external-result-1',
      externalMatchId: 'fixture-arg-eng',
      matchId: 'match-1',
      tournamentId: 'tournament-1',
      state: 'DISCARDED',
      discardedAt: new Date('2026-05-08T12:00:00.000Z'),
    };

    const sportsDataSyncService = {
      discardExternalMatchResult: jest.fn(async () => summary),
    } as unknown as SportsDataSyncService;
    const controller = new SportsDataController(sportsDataSyncService);

    await expect(controller.discardExternalMatchResult('external-result-1')).resolves.toEqual(summary);
    expect(sportsDataSyncService.discardExternalMatchResult).toHaveBeenCalledWith({
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

  it('requires the matches finalize permission to list staged results', () => {
    const requiredPermissions = Reflect.getMetadata(
      AUTH_PERMISSION_METADATA_KEYS.REQUIRED_PERMISSIONS,
      SportsDataController.prototype.listExternalMatchResults,
    ) as string[] | undefined;

    expect(requiredPermissions).toEqual([AUTH_PERMISSIONS.MATCHES_FINALIZE]);
  });

  it('requires the matches finalize permission to discard staged results', () => {
    const requiredPermissions = Reflect.getMetadata(
      AUTH_PERMISSION_METADATA_KEYS.REQUIRED_PERMISSIONS,
      SportsDataController.prototype.discardExternalMatchResult,
    ) as string[] | undefined;

    expect(requiredPermissions).toEqual([AUTH_PERMISSIONS.MATCHES_FINALIZE]);
  });
});
