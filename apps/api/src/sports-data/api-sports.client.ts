import type {
	ApiSportsClientOptions,
	ApiSportsClientLike,
	ApiSportsTournamentConfig,
	ApiSportsTeamCollectionResponse,
	ApiSportsFixtureCollectionResponse,
} from "./api-sports.types";

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";

/**
 * api-sports.io v3 HTTP client.
 * Mirrors FootballDataClient patterns: fetch-based, token in header, typed request/response.
 */
export class ApiSportsClient implements ApiSportsClientLike {
	private readonly baseUrl: string;
	private readonly apiKey: string | undefined;

	constructor(private readonly options: ApiSportsClientOptions = {}) {
		this.baseUrl = options.baseUrl?.trim() || DEFAULT_BASE_URL;
		this.apiKey = options.apiKey?.trim();
	}

	async listTeams(
		config: ApiSportsTournamentConfig,
	): Promise<ApiSportsTeamCollectionResponse> {
		return this.request<ApiSportsTeamCollectionResponse>(
			this.buildTeamsPath(config),
		);
	}

	async listFixtures(
		config: ApiSportsTournamentConfig,
	): Promise<ApiSportsFixtureCollectionResponse> {
		return this.request<ApiSportsFixtureCollectionResponse>(
			this.buildFixturesPath(config),
		);
	}

	/** Builds the teams endpoint path with league and season query params. */
	private buildTeamsPath(config: ApiSportsTournamentConfig): string {
		const params = new URLSearchParams({
			league: String(config.leagueId),
			season: String(config.season),
		});
		return `/teams?${params}`;
	}

	/** Builds the fixtures endpoint path with league and season query params. */
	private buildFixturesPath(config: ApiSportsTournamentConfig): string {
		const params = new URLSearchParams({
			league: String(config.leagueId),
			season: String(config.season),
		});
		return `/fixtures?${params}`;
	}

	private async request<TResponse>(path: string): Promise<TResponse> {
		const fetchImpl = this.options.fetchImpl ?? fetch;
		const response = await fetchImpl(`${this.baseUrl}${path}`, {
			headers: this.createHeaders(),
		});

		if (!response.ok) {
			throw new Error(
				`api-sports.io request failed with status ${response.status}`,
			);
		}

		return (await response.json()) as TResponse;
	}

	private createHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			Accept: "application/json",
		};

		if (this.apiKey) {
			headers["x-apisports-key"] = this.apiKey;
		}

		return headers;
	}
}
