import { BadRequestException } from '@nestjs/common';

import { AUTH_PERMISSION_METADATA_KEYS, AUTH_PERMISSIONS } from '../auth/auth.constants';
import { SportsDataController } from './sports-data.controller';
import type {
  ConfirmExternalMatchResultSummary,
  DiscardExternalMatchResultSummary,
  ExternalMatchMappingDiagnosticSummary,
  ExternalMatchResultSummary,
  ExternalSyncRunSummary,
  SportsDataSyncService,
} from './sports-data-sync.service';

describe('SportsDataController', () => {
  it('lists match mapping diagnostics for admin review', async () => {
    const diagnostics: ExternalMatchMappingDiagnosticSummary[] = [
      {
        matchId: 'match-1',
        status: 'UPCOMING',
        kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
        homeTeamName: 'Argentina',
        awayTeamName: 'England',
        stage: 'Group Stage',
        groupName: 'Group A',
        externalMatchId: 'fixture-arg-eng',
        hasExternalReference: true,
        latestExternalResult: null,
      },
    ];

    const sportsDataSyncService = {
      listExternalMatchMappingDiagnostics: jest.fn(async () => diagnostics),
    } as unknown as SportsDataSyncService;
    const controller = new SportsDataController(sportsDataSyncService);

    await expect(controller.listExternalMatchMappingDiagnostics({})).resolves.toEqual(diagnostics);
    expect(sportsDataSyncService.listExternalMatchMappingDiagnostics).toHaveBeenCalledWith({
      tournamentContext: {
        explicitTournamentId: undefined,
        selectedSlug: undefined,
      },
    });
  });

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
    expect(sportsDataSyncService.listExternalMatchResults).toHaveBeenCalledWith({
      state: 'PENDING_CONFIRMATION',
      tournamentContext: {
        explicitTournamentId: undefined,
        selectedSlug: undefined,
      },
    });
  });

  it('passes tournament context when listing external match results', async () => {
    const results: ExternalMatchResultSummary[] = [];

    const sportsDataSyncService = {
      listExternalMatchResults: jest.fn(async () => results),
    } as unknown as SportsDataSyncService;
    const controller = new SportsDataController(sportsDataSyncService);

    await controller.listExternalMatchResults({
      tournamentId: 'tournament-123',
      tournamentSlug: 'world-cup-2026',
    });

    expect(sportsDataSyncService.listExternalMatchResults).toHaveBeenCalledWith({
      state: 'PENDING_CONFIRMATION',
      tournamentContext: {
        explicitTournamentId: 'tournament-123',
        selectedSlug: 'world-cup-2026',
      },
    });
  });

  it('passes custom state through to service when listing external match results', async () => {
    const results: ExternalMatchResultSummary[] = [];

    const sportsDataSyncService = {
      listExternalMatchResults: jest.fn(async () => results),
    } as unknown as SportsDataSyncService;
    const controller = new SportsDataController(sportsDataSyncService);

    await controller.listExternalMatchResults({
      state: 'CONFIRMED',
      tournamentId: 'tournament-123',
    });

    expect(sportsDataSyncService.listExternalMatchResults).toHaveBeenCalledWith({
      state: 'CONFIRMED',
      tournamentContext: {
        explicitTournamentId: 'tournament-123',
        selectedSlug: undefined,
      },
    });
  });

  it('lists recent sync runs for admin operations', async () => {
    const syncRuns: ExternalSyncRunSummary[] = [
      {
        syncRunId: 'sync-1',
        providerKey: 'mock',
        tournamentId: 'tournament-1',
        syncType: 'RESULTS',
        status: 'SUCCESS',
        importedCount: 0,
        updatedCount: 0,
        stagedCount: 2,
        skippedCount: 0,
        errorMessage: null,
        startedAt: new Date('2026-05-08T12:00:00.000Z'),
        completedAt: new Date('2026-05-08T12:01:00.000Z'),
      },
    ];

    const sportsDataSyncService = {
      listRecentSyncRuns: jest.fn(async () => syncRuns),
    } as unknown as SportsDataSyncService;
    const controller = new SportsDataController(sportsDataSyncService);

    await expect(controller.listRecentSyncRuns({})).resolves.toEqual(syncRuns);
    expect(sportsDataSyncService.listRecentSyncRuns).toHaveBeenCalledWith({
      tournamentContext: {
        explicitTournamentId: undefined,
        selectedSlug: undefined,
      },
    });
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

  it('requires the matches finalize permission to list mapping diagnostics', () => {
    const requiredPermissions = Reflect.getMetadata(
      AUTH_PERMISSION_METADATA_KEYS.REQUIRED_PERMISSIONS,
      SportsDataController.prototype.listExternalMatchMappingDiagnostics,
    ) as string[] | undefined;

    expect(requiredPermissions).toEqual([AUTH_PERMISSIONS.MATCHES_FINALIZE]);
  });

  it('requires the matches finalize permission to list recent sync runs', () => {
    const requiredPermissions = Reflect.getMetadata(
      AUTH_PERMISSION_METADATA_KEYS.REQUIRED_PERMISSIONS,
      SportsDataController.prototype.listRecentSyncRuns,
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

  describe('importTournament', () => {
    it('rejects import when tournamentId is undefined', async () => {
      const sportsDataSyncService = {
        importTournament: jest.fn(),
      } as unknown as SportsDataSyncService;
      const controller = new SportsDataController(sportsDataSyncService);

      await expect(controller.importTournament(undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.importTournament(undefined)).rejects.toThrow(
        'tournamentId is required for sync/import operations. Explicit tournamentId must be provided.',
      );
    });

    it('rejects import when tournamentId is missing (undefined)', async () => {
      const sportsDataSyncService = {
        importTournament: jest.fn(),
      } as unknown as SportsDataSyncService;
      const controller = new SportsDataController(sportsDataSyncService);

      await expect(controller.importTournament(undefined)).rejects.toThrow(BadRequestException);
    });

    it('rejects import when tournamentId is empty string', async () => {
      const sportsDataSyncService = {
        importTournament: jest.fn(),
      } as unknown as SportsDataSyncService;
      const controller = new SportsDataController(sportsDataSyncService);

      await expect(controller.importTournament('')).rejects.toThrow(BadRequestException);
      await expect(controller.importTournament('   ')).rejects.toThrow(BadRequestException);
    });

    it('accepts import when tournamentId is provided', async () => {
      const summary = {
        syncRunId: 'sync-1',
        providerKey: 'mock',
        tournamentId: 'tournament-1',
        syncType: 'IMPORT',
        status: 'SUCCESS',
        importedCount: 10,
        updatedCount: 5,
        stagedCount: 0,
        skippedCount: 0,
      };

      const sportsDataSyncService = {
        importTournament: jest.fn(async () => summary),
      } as unknown as SportsDataSyncService;
      const controller = new SportsDataController(sportsDataSyncService);

      await expect(controller.importTournament('tournament-1')).resolves.toEqual(summary);
      expect(sportsDataSyncService.importTournament).toHaveBeenCalledWith('tournament-1');
    });
  });

  describe('syncResults', () => {
    it('rejects sync when tournamentId is undefined', async () => {
      const sportsDataSyncService = {
        syncResults: jest.fn(),
      } as unknown as SportsDataSyncService;
      const controller = new SportsDataController(sportsDataSyncService);

      await expect(controller.syncResults(undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.syncResults(undefined)).rejects.toThrow(
        'tournamentId is required for sync/results operations. Explicit tournamentId must be provided.',
      );
    });

    it('rejects sync when tournamentId is missing (undefined)', async () => {
      const sportsDataSyncService = {
        syncResults: jest.fn(),
      } as unknown as SportsDataSyncService;
      const controller = new SportsDataController(sportsDataSyncService);

      await expect(controller.syncResults(undefined)).rejects.toThrow(BadRequestException);
    });

    it('rejects sync when tournamentId is empty string', async () => {
      const sportsDataSyncService = {
        syncResults: jest.fn(),
      } as unknown as SportsDataSyncService;
      const controller = new SportsDataController(sportsDataSyncService);

      await expect(controller.syncResults('')).rejects.toThrow(BadRequestException);
      await expect(controller.syncResults('   ')).rejects.toThrow(BadRequestException);
    });

    it('accepts sync when tournamentId is provided', async () => {
      const summary = {
        syncRunId: 'sync-2',
        providerKey: 'mock',
        tournamentId: 'tournament-1',
        syncType: 'RESULTS',
        status: 'SUCCESS',
        importedCount: 0,
        updatedCount: 0,
        stagedCount: 3,
        skippedCount: 0,
      };

      const sportsDataSyncService = {
        syncResults: jest.fn(async () => summary),
      } as unknown as SportsDataSyncService;
      const controller = new SportsDataController(sportsDataSyncService);

      await expect(controller.syncResults('tournament-1')).resolves.toEqual(summary);
      expect(sportsDataSyncService.syncResults).toHaveBeenCalledWith('tournament-1');
    });
  });
});
