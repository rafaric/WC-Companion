import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuthModule } from "../auth/auth.module";
import { MatchesModule } from "../matches/matches.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TournamentsModule } from "../tournaments/tournaments.module";
import {
	SPORTS_DATA_PROVIDER,
	SPORTS_DATA_PROVIDER_KEYS,
} from "./sports-data.constants";
import { FootballDataClient } from "./football-data.client";
import { FOOTBALL_DATA_TOURNAMENT_CONFIGS } from "./football-data.config";
import { FootballDataProvider } from "./football-data.provider";
import { ApiSportsClient } from "./api-sports.client";
import { ApiSportsProvider } from "./api-sports.provider";
import { API_SPORTS_TOURNAMENT_CONFIGS } from "./api-sports.config";
import { MockSportsDataProvider } from "./mock-sports-data.provider";
import { LpfWebClient } from "./lpf-web.client";
import { LPF_WEB_TOURNAMENT_CONFIGS } from "./lpf-web.config";
import { LpfWebProvider } from "./lpf-web.provider";
import { SportsDataController } from "./sports-data.controller";
import { SportsDataSyncService } from "./sports-data-sync.service";
import type { SportsDataProvider } from "./sports-data.types";

@Module({
	imports: [PrismaModule, AuthModule, MatchesModule, TournamentsModule],
	controllers: [SportsDataController],
	providers: [
		SportsDataSyncService,
		{
			provide: SPORTS_DATA_PROVIDER,
			inject: [ConfigService],
			useFactory: (configService: ConfigService): SportsDataProvider => {
				const providerKey =
					configService
						.get<string>("SPORTS_DATA_PROVIDER")
						?.trim()
						.toLowerCase() ?? SPORTS_DATA_PROVIDER_KEYS.MOCK;

				if (providerKey === SPORTS_DATA_PROVIDER_KEYS.FOOTBALL_DATA) {
					return new FootballDataProvider(
						new FootballDataClient({
							baseUrl:
								configService.get<string>("FOOTBALL_DATA_BASE_URL") ??
								undefined,
							apiToken:
								configService.get<string>("FOOTBALL_DATA_API_TOKEN") ??
								undefined,
						}),
						FOOTBALL_DATA_TOURNAMENT_CONFIGS,
					);
				}

				if (providerKey === SPORTS_DATA_PROVIDER_KEYS.API_SPORTS) {
					return new ApiSportsProvider(
						new ApiSportsClient({
							baseUrl:
								configService.get<string>("API_SPORTS_BASE_URL") ?? undefined,
							apiKey:
								configService.get<string>("API_SPORTS_API_KEY") ?? undefined,
						}),
						API_SPORTS_TOURNAMENT_CONFIGS,
					);
				}

				if (providerKey === SPORTS_DATA_PROVIDER_KEYS.LPF_WEB) {
					const omoUser = configService
						.get<string>("LPF_WEB_OMO_USER")
						?.trim();
					const omoPassword = configService
						.get<string>("LPF_WEB_OMO_PASSWORD")
						?.trim();
					return new LpfWebProvider(
						new LpfWebClient({
							baseUrl:
								configService.get<string>("LPF_WEB_BASE_URL") ??
								undefined,
							omoUser: omoUser || undefined,
							omoPassword: omoPassword || undefined,
							widgetJsUrl:
								configService.get<string>("LPF_WEB_WIDGET_JS_URL") ??
								undefined,
						}),
						LPF_WEB_TOURNAMENT_CONFIGS,
					);
				}

				return new MockSportsDataProvider();
			},
		},
	],
	exports: [SportsDataSyncService],
})
export class SportsDataModule {}