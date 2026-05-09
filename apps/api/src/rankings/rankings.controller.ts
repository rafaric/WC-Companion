import { Controller, Get } from '@nestjs/common';

import type { RankingEntryView } from './rankings.service';
import { RankingsService } from './rankings.service';

@Controller('rankings')
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get('global')
  async getGlobalRanking(): Promise<RankingEntryView[]> {
    return this.rankingsService.getActiveGlobalRanking();
  }
}
