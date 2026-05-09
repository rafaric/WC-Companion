import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RankingsModule } from '../rankings/rankings.module';
import { ScoringModule } from '../scoring/scoring.module';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [AuthModule, ScoringModule, RankingsModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
