import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

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

@Controller('admin/sports-data/external-results')
@UseGuards(Auth0JwtGuard, PermissionsGuard)
export class SportsDataController {
  constructor(private readonly sportsDataSyncService: SportsDataSyncService) {}

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Get('diagnostics/matches')
  async listExternalMatchMappingDiagnostics(): Promise<ExternalMatchMappingDiagnosticSummary[]> {
    return this.sportsDataSyncService.listExternalMatchMappingDiagnostics();
  }

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Get('sync-runs')
  async listRecentSyncRuns(): Promise<ExternalSyncRunSummary[]> {
    return this.sportsDataSyncService.listRecentSyncRuns();
  }

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Get()
  async listExternalMatchResults(
    @Query() query: ListExternalMatchResultsQueryDto,
  ): Promise<ExternalMatchResultSummary[]> {
    return this.sportsDataSyncService.listExternalMatchResults(
      query.state ?? EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION,
    );
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
  async importTournament(@Body('tournamentId') tournamentId?: string): Promise<SportsDataSyncSummary> {
    return this.sportsDataSyncService.importTournament(tournamentId);
  }

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Post('sync/results')
  async syncResults(@Body('tournamentId') tournamentId?: string): Promise<SportsDataSyncSummary> {
    return this.sportsDataSyncService.syncResults(tournamentId);
  }
}
