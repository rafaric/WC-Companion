import { Controller, Param, Post, UseGuards } from '@nestjs/common';

import { AUTH_PERMISSIONS } from '../auth/auth.constants';
import { Auth0JwtGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ConfirmExternalMatchResultSummary, SportsDataSyncService } from './sports-data-sync.service';

@Controller('admin/sports-data/external-results')
@UseGuards(Auth0JwtGuard, PermissionsGuard)
export class SportsDataController {
  constructor(private readonly sportsDataSyncService: SportsDataSyncService) {}

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Post(':externalMatchResultId/confirm')
  async confirmExternalMatchResult(
    @Param('externalMatchResultId') externalMatchResultId: string,
  ): Promise<ConfirmExternalMatchResultSummary> {
    return this.sportsDataSyncService.confirmExternalMatchResult({ externalMatchResultId });
  }
}
