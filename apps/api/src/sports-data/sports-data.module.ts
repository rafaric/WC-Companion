import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AuthModule } from "../auth/auth.module";
import { MatchesModule } from "../matches/matches.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TournamentsModule } from "../tournaments/tournaments.module";
import { SPORTS_DATA_PROVIDER_KEYS } from "./sports-data.constants";
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
import { SportsDataProviderFactory } from "./sports-data-provider.factory";
import type { SportsDataProvider } from "./sports-data.types";

/**
 * Creates a provider instance with lazy initialization.
 * The provider is created only if credentials are available, otherwise undefined.
 * Errors during initialization are caught and logged, returning undefined.
 */
function safeCreateProvider<T extends SportsDataProvider>(
	name: string,
	createFn: () => T,
): T | undefined {
	try {
		return createFn();
	} catch (error) {
		console.warn(
			`[SportsDataModule] Failed to initialize '${name}' provider:`,
			error instanceof Error ? error.message : error,
		);
		return undefined;
	}
}

@Module({
	imports: [PrismaModule, AuthModule, MatchesModule, TournamentsModule],
	controllers: [SportsDataController],
	providers: [
		// Mock provider - always available (no credentials needed)
		{
			provide: "SPORTS_DATA_MOCK_PROVIDER",
			useFactory: (): SportsDataProvider => new MockSportsDataProvider(),
		},
		// Football-Data provider - requires FOOTBALL_DATA_API_TOKEN
		{
			provide: "SPORTS_DATA_FOOTBALL_DATA_PROVIDER",
			inject: [ConfigService],
			useFactory: (
				configService: ConfigService,
			): SportsDataProvider | undefined => {
				return safeCreateProvider("football-data", () => {
					const apiToken = configService.get<string>("FOOTBALL_DATA_API_TOKEN");
					if (!apiToken?.trim()) {
						throw new Error("FOOTBALL_DATA_API_TOKEN is not configured");
					}
					return new FootballDataProvider(
						new FootballDataClient({
							baseUrl:
								configService.get<string>("FOOTBALL_DATA_BASE_URL") ??
								undefined,
							apiToken: apiToken.trim(),
						}),
						FOOTBALL_DATA_TOURNAMENT_CONFIGS,
					);
				});
			},
		},
		// API-Sports provider - requires API_SPORTS_API_KEY
		{
			provide: "SPORTS_DATA_API_SPORTS_PROVIDER",
			inject: [ConfigService],
			useFactory: (
				configService: ConfigService,
			): SportsDataProvider | undefined => {
				return safeCreateProvider("api-sports", () => {
					const apiKey = configService.get<string>("API_SPORTS_API_KEY");
					if (!apiKey?.trim()) {
						throw new Error("API_SPORTS_API_KEY is not configured");
					}
					return new ApiSportsProvider(
						new ApiSportsClient({
							baseUrl:
								configService.get<string>("API_SPORTS_BASE_URL") ?? undefined,
							apiKey: apiKey.trim(),
						}),
						API_SPORTS_TOURNAMENT_CONFIGS,
					);
				});
			},
		},
		// LPF Web provider - requires LPF_WEB_BASE_URL (credentials are auto-discovered)
		{
			provide: "SPORTS_DATA_LPF_WEB_PROVIDER",
			inject: [ConfigService],
			useFactory: (
				configService: ConfigService,
			): SportsDataProvider | undefined => {
				return safeCreateProvider("lpf-web", () => {
					const baseUrl = configService.get<string>("LPF_WEB_BASE_URL");
					if (!baseUrl?.trim()) {
						throw new Error("LPF_WEB_BASE_URL is not configured");
					}
					const omoUser = configService.get<string>("LPF_WEB_OMO_USER")?.trim();
					const omoPassword = configService
						.get<string>("LPF_WEB_OMO_PASSWORD")
						?.trim();
					return new LpfWebProvider(
						new LpfWebClient({
							baseUrl: baseUrl.trim(),
							omoUser: omoUser || undefined,
							omoPassword: omoPassword || undefined,
							widgetJsUrl:
								configService.get<string>("LPF_WEB_WIDGET_JS_URL") ?? undefined,
						}),
						LPF_WEB_TOURNAMENT_CONFIGS,
					);
				});
			},
		},
		// Provider factory - receives all providers and resolves by key
		SportsDataProviderFactory,
		// Sync service
		SportsDataSyncService,
	],
	exports: [SportsDataSyncService, SportsDataProviderFactory],
})
export class SportsDataModule {}
