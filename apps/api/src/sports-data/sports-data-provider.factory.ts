import { Inject, Injectable, Optional } from "@nestjs/common";

import {
	SPORTS_DATA_PROVIDER_KEYS,
	DEFAULT_SPORTS_DATA_PROVIDER_KEY,
	type SportsDataProviderKey,
} from "./sports-data.constants";
import type { SportsDataProvider } from "./sports-data.types";

/**
 * Factory for resolving the correct SportsDataProvider based on providerKey.
 *
 * This factory receives all available providers at construction time (DI).
 * It resolves the correct provider based on the tournament's providerKey field.
 * Falls back to the system default provider if no matching provider is found.
 *
 * Note: All providers are registered so the app starts with all configs.
 * Providers without credentials configured will fail at runtime (not startup).
 */
@Injectable()
export class SportsDataProviderFactory {
	constructor(
		@Inject("SPORTS_DATA_MOCK_PROVIDER")
		private readonly mockProvider: SportsDataProvider,
		@Optional()
		@Inject("SPORTS_DATA_FOOTBALL_DATA_PROVIDER")
		private readonly footballDataProvider?: SportsDataProvider,
		@Optional()
		@Inject("SPORTS_DATA_API_SPORTS_PROVIDER")
		private readonly apiSportsProvider?: SportsDataProvider,
		@Optional()
		@Inject("SPORTS_DATA_LPF_WEB_PROVIDER")
		private readonly lpfWebProvider?: SportsDataProvider,
	) {}

	/**
	 * Get the provider instance for the given providerKey.
	 *
	 * @param providerKey - The provider key from tournament.providerKey or system default
	 * @returns The matching SportsDataProvider instance
	 * @throws Error if the requested provider is not registered
	 */
	getProvider(providerKey: string | null | undefined): SportsDataProvider {
		const key = (providerKey ??
			DEFAULT_SPORTS_DATA_PROVIDER_KEY) as SportsDataProviderKey;

		switch (key) {
			case SPORTS_DATA_PROVIDER_KEYS.FOOTBALL_DATA:
				if (!this.footballDataProvider) {
					throw new Error(
						`Sports data provider '${key}' is not configured. ` +
							`Ensure FOOTBALL_DATA_API_TOKEN and FOOTBALL_DATA_BASE_URL are set.`,
					);
				}
				return this.footballDataProvider;
			case SPORTS_DATA_PROVIDER_KEYS.API_SPORTS:
				if (!this.apiSportsProvider) {
					throw new Error(
						`Sports data provider '${key}' is not configured. ` +
							`Ensure API_SPORTS_API_KEY and API_SPORTS_BASE_URL are set.`,
					);
				}
				return this.apiSportsProvider;
			case SPORTS_DATA_PROVIDER_KEYS.LPF_WEB:
				if (!this.lpfWebProvider) {
					throw new Error(
						`Sports data provider '${key}' is not configured. ` +
							`Ensure LPF_WEB_BASE_URL is set (credentials are auto-discovered from widget JS).`,
					);
				}
				return this.lpfWebProvider;
			case SPORTS_DATA_PROVIDER_KEYS.MOCK:
				if (!this.mockProvider) {
					throw new Error(
						`Sports data provider '${key}' is not configured. ` +
							`This is the default provider and should always be available.`,
					);
				}
				return this.mockProvider;
			default:
				throw new Error(
					`Unknown sports data provider key: '${key}'. ` +
						`Available providers: ${this.getAvailableProviders().join(", ")}`,
				);
		}
	}

	/**
	 * Get all registered provider keys (for admin/discovery purposes).
	 */
	getAvailableProviders(): SportsDataProviderKey[] {
		return Object.values(SPORTS_DATA_PROVIDER_KEYS);
	}

	/**
	 * Get the system default provider key.
	 */
	getDefaultProviderKey(): SportsDataProviderKey {
		return DEFAULT_SPORTS_DATA_PROVIDER_KEY;
	}
}
