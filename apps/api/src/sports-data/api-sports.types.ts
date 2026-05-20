/**
 * api-sports.io v3 raw response types.
 * Only models fields consumed by ApiSportsProvider.
 */

export interface ApiSportsTournamentConfig {
	leagueId: number;
	season: number;
	displayName: string;
}

export type ApiSportsTournamentConfigMap = Readonly<
	Record<string, ApiSportsTournamentConfig>
>;

export interface ApiSportsClientOptions {
	baseUrl?: string;
	apiKey?: string;
	fetchImpl?: typeof fetch;
}

/** Minimal team shape from api-sports /teams endpoint. */
export interface ApiSportsTeamApiResponse {
	team: {
		id: number;
		name: string;
		code: string | null;
		country: string | null;
	};
}

/** Teams list envelope. */
export interface ApiSportsTeamCollectionResponse {
	response: readonly ApiSportsTeamApiResponse[];
}

/**
 * Minimal fixture shape from api-sports /fixtures endpoint.
 * Covers fields used for team mapping, venue mapping, fixture listing, and final-results filtering.
 */
export interface ApiSportsFixtureApiResponse {
	fixture: {
		id: number;
		date: string;
		status: {
			short: string;
		};
		venue: {
			id: number | null;
			name: string | null;
			city: string | null;
		} | null;
	};
	league: {
		round: string;
	};
	teams: {
		home: {
			id: number | null;
			name: string;
			code: string | null;
		};
		away: {
			id: number | null;
			name: string;
			code: string | null;
		};
	};
	goals: {
		home: number | null;
		away: number | null;
	};
}

/** Fixtures list envelope. */
export interface ApiSportsFixtureCollectionResponse {
	response: readonly ApiSportsFixtureApiResponse[];
}

/** Interface the ApiSportsProvider consumes — mirrors FootballDataClientLike. */
export interface ApiSportsClientLike {
	listTeams(
		config: ApiSportsTournamentConfig,
	): Promise<ApiSportsTeamCollectionResponse>;
	listFixtures(
		config: ApiSportsTournamentConfig,
	): Promise<ApiSportsFixtureCollectionResponse>;
}
