import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';

import { Auth0JwtGuard } from '../auth/auth.guard';
import { FinalizeMatchDto } from './dto/finalize-match.dto';
import { MatchesService } from './matches.service';

@Controller('admin/matches')
@UseGuards(Auth0JwtGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  // TODO: add real admin-role authorization once the role model is available.
  @Patch(':matchId/finalize')
  async finalizeMatch(@Param('matchId') matchId: string, @Body() body: FinalizeMatchDto) {
    return this.matchesService.finalizeMatch({
      matchId,
      homeScore: body.homeScore,
      awayScore: body.awayScore,
    });
  }
}
