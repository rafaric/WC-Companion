import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { MatchesModule } from '../matches/matches.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SPORTS_DATA_PROVIDER, SPORTS_DATA_PROVIDER_KEYS } from './sports-data.constants';
import { FootballDataClient } from './football-data.client';
import { FOOTBALL_DATA_TOURNAMENT_CONFIGS } from './football-data.config';
import { FootballDataProvider } from './football-data.provider';
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
      inject: [ConfigService],
      useFactory: (configService: ConfigService): MockSportsDataProvider | FootballDataProvider => {
        const providerKey = configService.get<string>('SPORTS_DATA_PROVIDER')?.trim().toLowerCase() ?? SPORTS_DATA_PROVIDER_KEYS.MOCK;

        if (providerKey === SPORTS_DATA_PROVIDER_KEYS.FOOTBALL_DATA) {
          return new FootballDataProvider(
            new FootballDataClient({
              baseUrl: configService.get<string>('FOOTBALL_DATA_BASE_URL') ?? undefined,
              apiToken: configService.get<string>('FOOTBALL_DATA_API_TOKEN') ?? undefined,
            }),
            FOOTBALL_DATA_TOURNAMENT_CONFIGS,
          );
        }

        return new MockSportsDataProvider();
      },
    },
  ],
  exports: [SportsDataSyncService],
})
export class SportsDataModule {}
