import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { SPORTS_DATA_PROVIDER } from './sports-data.constants';
import { MockSportsDataProvider } from './mock-sports-data.provider';
import { SportsDataSyncService } from './sports-data-sync.service';

@Module({
  imports: [PrismaModule],
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
