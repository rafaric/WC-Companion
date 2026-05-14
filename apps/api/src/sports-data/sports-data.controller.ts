import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { AUTH_PERMISSIONS } from '../auth/auth.constants';
import { Auth0JwtGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { EXTERNAL_MATCH_RESULT_STATES } from './sports-data.constants';
import { ListExternalMatchResultsQueryDto } from './dto/list-external-match-results.query';
import {
  ConfirmExternalMatchResultSummary,
  DiscardExternalMatchResultSummary,
  ExternalMatchMappingDiagnosticSummary,
  ExternalMatchResultSummary,
  ExternalSyncRunSummary,
  SportsDataSyncService,
} from './sports-data-sync.service';
import type { SportsDataSyncSummary } from './sports-data.types';

/**
 * Query parameters for tournament context in admin endpoints.
 */
export interface TournamentContextQuery {
  tournamentId?: string | null;
  tournamentSlug?: string | null;
}

@Controller('admin/sports-data/external-results')
@UseGuards(Auth0JwtGuard, PermissionsGuard)
export class SportsDataController {
  constructor(private readonly sportsDataSyncService: SportsDataSyncService) {}

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Get('diagnostics/matches')
  async listExternalMatchMappingDiagnostics(
    @Query() query: TournamentContextQuery,
  ): Promise<ExternalMatchMappingDiagnosticSummary[]> {
    return this.sportsDataSyncService.listExternalMatchMappingDiagnostics({
      tournamentContext: {
        explicitTournamentId: query.tournamentId,
        selectedSlug: query.tournamentSlug,
      },
    });
  }

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Get('sync-runs')
  async listRecentSyncRuns(
    @Query() query: TournamentContextQuery,
  ): Promise<ExternalSyncRunSummary[]> {
    return this.sportsDataSyncService.listRecentSyncRuns({
      tournamentContext: {
        explicitTournamentId: query.tournamentId,
        selectedSlug: query.tournamentSlug,
      },
    });
  }

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Get()
  async listExternalMatchResults(
    @Query() query: ListExternalMatchResultsQueryDto,
  ): Promise<ExternalMatchResultSummary[]> {
    return this.sportsDataSyncService.listExternalMatchResults({
      state: query.state ?? EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION,
      tournamentContext: {
        explicitTournamentId: query.tournamentId,
        selectedSlug: query.tournamentSlug,
      },
    });
  }

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Post(':externalMatchResultId/confirm')
  async confirmExternalMatchResult(
    @Param('externalMatchResultId') externalMatchResultId: string,
  ): Promise<ConfirmExternalMatchResultSummary> {
    return this.sportsDataSyncService.confirmExternalMatchResult({ externalMatchResultId });
  }

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Post(':externalMatchResultId/discard')
  async discardExternalMatchResult(
    @Param('externalMatchResultId') externalMatchResultId: string,
  ): Promise<DiscardExternalMatchResultSummary> {
    return this.sportsDataSyncService.discardExternalMatchResult({ externalMatchResultId });
  }

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Post('sync/import')
  async importTournament(@Body('tournamentId') tournamentId: string | undefined): Promise<SportsDataSyncSummary> {
    if (tournamentId === undefined || tournamentId === null || tournamentId.trim() === '') {
      throw new BadRequestException('tournamentId is required for sync/import operations. Explicit tournamentId must be provided.');
    }
    return this.sportsDataSyncService.importTournament(tournamentId);
  }

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Post('sync/results')
  async syncResults(@Body('tournamentId') tournamentId: string | undefined): Promise<SportsDataSyncSummary> {
    if (tournamentId === undefined || tournamentId === null || tournamentId.trim() === '') {
      throw new BadRequestException('tournamentId is required for sync/results operations. Explicit tournamentId must be provided.');
    }
    return this.sportsDataSyncService.syncResults(tournamentId);
  }
}
