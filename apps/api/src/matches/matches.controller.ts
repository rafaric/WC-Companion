import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';

import { AUTH_PERMISSIONS } from '../auth/auth.constants';
import { Auth0JwtGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { FinalizeMatchDto } from './dto/finalize-match.dto';
import { MatchesService, type FinalizeMatchSummary } from './matches.service';

@Controller('admin/matches')
@UseGuards(Auth0JwtGuard, PermissionsGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @RequirePermissions(AUTH_PERMISSIONS.MATCHES_FINALIZE)
  @Patch(':matchId/finalize')
  async finalizeMatch(
    @Param('matchId') matchId: string,
    @Body() body: FinalizeMatchDto,
  ): Promise<FinalizeMatchSummary> {
    return this.matchesService.finalizeMatch({
      matchId,
      homeScore: body.homeScore,
      awayScore: body.awayScore,
    });
  }
}
