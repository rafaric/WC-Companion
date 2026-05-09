import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { MatchesModule } from './matches/matches.module';
import { PredictionsModule } from './predictions/predictions.module';
import { PrismaModule } from './prisma/prisma.module';
import { ShareCardsModule } from './share-cards/share-cards.module';
import { RankingsModule } from './rankings/rankings.module';
import { ScoringModule } from './scoring/scoring.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    TournamentsModule,
    MatchesModule,
    PredictionsModule,
    ScoringModule,
    RankingsModule,
    GroupsModule,
    ShareCardsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
