import { NotFoundException } from "@nestjs/common";

import type {
	ApiSportsClientLike,
	ApiSportsTournamentConfig,
	ApiSportsTournamentConfigMap,
} from "./api-sports.types";
import type { SportsDataProvider } from "./sports-data.types";
import {
	SPORTS_DATA_PROVIDER_KEYS,
	type SportsDataProviderKey,
} from "./sports-data.constants";
import type {
	SportsDataFinalResultDTO,
	SportsDataFixtureDTO,
	SportsDataTeamDTO,
	SportsDataVenueDTO,
} from "./sports-data.types";

/** Extracts a short name from a team name using word initials. */
function buildAcronym(name: string): string {
	return name
		.split(/\s+/)
		.filter((segment) => segment.length > 0)
		.map((segment) => segment[0]?.toUpperCase() ?? "")
		.join("");
}

/** Returns a best-effort short name from team name and optional code. */
function resolveShortName(name: string, code: string | null): string {
	const trimmed = code?.trim() ?? null;
	if (trimmed && trimmed.length > 0) {
		return trimmed.toUpperCase();
	}

	const acronym = buildAcronym(name);
	if (acronym.length >= 3) {
		return acronym;
	}

	return name
		.replace(/[^A-Za-z0-9]/g, "")
		.slice(0, 3)
		.toUpperCase();
}

/** api-sports team payload shape consumed by mapTeamFromRaw. */
type RawTeam = { team: { id: number; name: string; code: string | null } };

function mapTeamFromRaw(raw: RawTeam): SportsDataTeamDTO {
	return {
		externalId: String(raw.team.id),
		name: raw.team.name,
		shortName: resolveShortName(raw.team.name, raw.team.code ?? null),
		countryCode: null,
		flagCode: null,
		primaryColor: null,
		secondaryColor: null,
		crestUrl: null,
	};
}

/** api-sports fixture payload shape consumed by mapFixtureFromRaw and mapFinalResultFromRaw. */
type RawFixture = {
	fixture: {
		id: number;
		date: string;
		venue: {
			id: number | null;
			name: string | null;
			city: string | null;
		} | null;
	};
	league: { round: string };
	teams: {
		home: { id: number | null; name: string; code: string | null };
		away: { id: number | null; name: string; code: string | null };
	};
	goals: { home: number | null; away: number | null };
};

function parseProviderDate(dateValue: string, fixtureId: number): Date {
	const parsedDate = new Date(dateValue);
	if (Number.isNaN(parsedDate.getTime())) {
		throw new Error(`api-sports fixture ${fixtureId} has invalid date data`);
	}
	return parsedDate;
}

function mapFixtureFromRaw(raw: RawFixture): SportsDataFixtureDTO {
	// Skip fixtures missing either team id (same safety pattern as football-data)
	if (raw.teams.home.id === null || raw.teams.away.id === null) {
		throw new Error(
			`api-sports fixture ${raw.fixture.id} is missing team ids and cannot be mapped`,
		);
	}

	return {
		externalId: String(raw.fixture.id),
		homeTeamExternalId: String(raw.teams.home.id),
		awayTeamExternalId: String(raw.teams.away.id),
		venueExternalId:
			raw.fixture.venue !== null && raw.fixture.venue.id !== null
				? String(raw.fixture.venue.id)
				: null,
		kickoffAt: parseProviderDate(raw.fixture.date, raw.fixture.id),
		stage: raw.league.round.trim() || null,
		groupName: null,
	};
}

function mapFinalResultFromRaw(raw: RawFixture): SportsDataFinalResultDTO {
	const homeScore = raw.goals.home;
	const awayScore = raw.goals.away;

	if (typeof homeScore !== "number" || typeof awayScore !== "number") {
		throw new Error(
			`api-sports fixture ${raw.fixture.id} is missing final score data`,
		);
	}

	return {
		externalMatchId: String(raw.fixture.id),
		homeScore,
		awayScore,
		playedAt: parseProviderDate(raw.fixture.date, raw.fixture.id),
	};
}

export class ApiSportsProvider implements SportsDataProvider {
	readonly providerKey: SportsDataProviderKey =
		SPORTS_DATA_PROVIDER_KEYS.API_SPORTS;

	constructor(
		private readonly client: ApiSportsClientLike,
		private readonly tournamentConfigs: ApiSportsTournamentConfigMap,
	) {}

	private resolveConfig(tournamentSlug: string): ApiSportsTournamentConfig {
		const config = this.tournamentConfigs[tournamentSlug];
		if (config === undefined) {
			throw new NotFoundException(
				`No api-sports tournament configuration found for tournament slug: ${tournamentSlug}`,
			);
		}
		return config;
	}

	async listTeams(
		tournamentSlug: string,
	): Promise<readonly SportsDataTeamDTO[]> {
		const config = this.resolveConfig(tournamentSlug);
		const response = await this.client.listTeams(config);
		return response.response.map(mapTeamFromRaw);
	}

	async listVenues(
		tournamentSlug: string,
	): Promise<readonly SportsDataVenueDTO[]> {
		const config = this.resolveConfig(tournamentSlug);
		const response = await this.client.listFixtures(config);

		const venueMap = new Map<string, SportsDataVenueDTO>();

		for (const raw of response.response) {
			const venue = raw.fixture.venue;
			if (
				venue?.id === null ||
				venue?.id === undefined ||
				!venue.name?.trim()
			) {
				continue;
			}
			const venueId = String(venue.id);
			if (venueMap.has(venueId)) {
				continue;
			}
			venueMap.set(venueId, {
				externalId: venueId,
				name: venue.name.trim(),
				city: venue.city?.trim() ?? null,
				countryCode: null,
				capacity: null,
			});
		}

		return Array.from(venueMap.values());
	}

	async listFixtures(
		tournamentSlug: string,
	): Promise<readonly SportsDataFixtureDTO[]> {
		const config = this.resolveConfig(tournamentSlug);
		const response = await this.client.listFixtures(config);

		const fixtures: SportsDataFixtureDTO[] = [];
		for (const raw of response.response) {
			// Skip fixtures missing either team id (same safety pattern as football-data)
			if (raw.teams.home.id === null || raw.teams.away.id === null) {
				continue;
			}
			fixtures.push(mapFixtureFromRaw(raw));
		}
		return fixtures;
	}

	async listFinalResults(
		tournamentSlug: string,
	): Promise<readonly SportsDataFinalResultDTO[]> {
		const config = this.resolveConfig(tournamentSlug);
		const response = await this.client.listFixtures(config);

		return response.response
			.filter((raw) => raw.fixture.status.short === "FT")
			.map(mapFinalResultFromRaw);
	}
}
