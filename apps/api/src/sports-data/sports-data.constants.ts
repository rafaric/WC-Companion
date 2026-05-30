export const SPORTS_DATA_PROVIDER_KEYS = {
	MOCK: "mock",
	FOOTBALL_DATA: "football-data",
	API_SPORTS: "api-sports",
	LPF_WEB: "lpf-web",
} as const;

export type SportsDataProviderKey =
	(typeof SPORTS_DATA_PROVIDER_KEYS)[keyof typeof SPORTS_DATA_PROVIDER_KEYS];

// System-level default provider (used when tournament has no providerKey)
export const DEFAULT_SPORTS_DATA_PROVIDER_KEY: SportsDataProviderKey =
	SPORTS_DATA_PROVIDER_KEYS.MOCK;

export const SPORTS_DATA_SYNC_TYPES = {
	IMPORT: "IMPORT",
	RESULTS: "RESULTS",
} as const;

export type SportsDataSyncType =
	(typeof SPORTS_DATA_SYNC_TYPES)[keyof typeof SPORTS_DATA_SYNC_TYPES];

export const SPORTS_DATA_SYNC_STATUSES = {
	RUNNING: "RUNNING",
	SUCCESS: "SUCCESS",
	FAILED: "FAILED",
} as const;

export type SportsDataSyncStatus =
	(typeof SPORTS_DATA_SYNC_STATUSES)[keyof typeof SPORTS_DATA_SYNC_STATUSES];

export const EXTERNAL_MATCH_RESULT_STATES = {
	PENDING_CONFIRMATION: "PENDING_CONFIRMATION",
	CONFIRMED: "CONFIRMED",
	DISCARDED: "DISCARDED",
} as const;

export type ExternalMatchResultState =
	(typeof EXTERNAL_MATCH_RESULT_STATES)[keyof typeof EXTERNAL_MATCH_RESULT_STATES];

export const SPORTS_DATA_PROVIDER = Symbol("SPORTS_DATA_PROVIDER");
