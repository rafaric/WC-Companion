import { Controller, Get, Query } from '@nestjs/common';

import type { RankingEntryView } from './rankings.service';
import { RankingsService } from './rankings.service';

interface TournamentContextQuery {
  tournamentId?: string | null;
  tournamentSlug?: string | null;
}

@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get('global')
  async getGlobalRanking(@Query() query: TournamentContextQuery): Promise<RankingEntryView[]> {
    return this.rankingsService.getActiveGlobalRanking({
      tournamentContext: {
        explicitTournamentId: query.tournamentId,
        selectedSlug: query.tournamentSlug,
      },
    });
  }
}
