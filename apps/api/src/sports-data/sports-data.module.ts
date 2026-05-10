import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SPORTS_DATA_PROVIDER } from './sports-data.constants';
import { MockSportsDataProvider } from './mock-sports-data.provider';
import { SportsDataController } from './sports-data.controller';
import { SportsDataSyncService } from './sports-data-sync.service';

@Module({
  imports: [PrismaModule, AuthModule, MatchesModule],
  controllers: [SportsDataController],
  providers: [
    SportsDataSyncService,
    {
      provide: SPORTS_DATA_PROVIDER,
      useFactory: () => new MockSportsDataProvider(),
    },
  ],
  exports: [SportsDataSyncService],
})
export class SportsDataModule {}
