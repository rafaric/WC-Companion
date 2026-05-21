import { NotFoundException } from "@nestjs/common";

import type {
	LpfWebClientLike,
	LpfWebTournamentConfigMap,
} from "./lpf-web.types";
import { SPORTS_DATA_PROVIDER_KEYS } from "./sports-data.constants";
import type { SportsDataProvider } from "./sports-data.types";
import type {
	SportsDataFinalResultDTO,
	SportsDataFixtureDTO,
	SportsDataTeamDTO,
	SportsDataVenueDTO,
} from "./sports-data.types";

/** Slugifies a team or venue name into a safe lowercase identifier. */
function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export class LpfWebProvider implements SportsDataProvider {
	readonly providerKey = SPORTS_DATA_PROVIDER_KEYS.LPF_WEB;

	constructor(
		private readonly client: LpfWebClientLike,
		private readonly tournamentConfigs: LpfWebTournamentConfigMap,
	) {}

	private resolveConfig(tournamentSlug: string) {
		const config = this.tournamentConfigs[tournamentSlug];
		if (config === undefined) {
			throw new NotFoundException(
				`No LPF web tournament configuration found for slug: ${tournamentSlug}`,
			);
		}
		return config;
	}

	async listTeams(
		tournamentSlug: string,
	): Promise<readonly SportsDataTeamDTO[]> {
		const config = this.resolveConfig(tournamentSlug);
		const raw = await this.client.fetchPage(config);
		const { rows } = await import("./lpf-web.parser").then((m) =>
			Promise.resolve(m.parseLpfPage(raw)),
		);

		const seen = new Set<string>();
		const teams: SportsDataTeamDTO[] = [];

		for (const row of rows) {
			for (const name of [row.homeTeamName, row.awayTeamName]) {
				const slug = slugify(name);
				const externalId = `lpf-web-team:${slug}`;
				if (!seen.has(externalId)) {
					seen.add(externalId);
					teams.push({
						externalId,
						name,
						shortName: this.resolveShortName(name),
						countryCode: null,
						flagCode: null,
						primaryColor: null,
						secondaryColor: null,
					});
				}
			}
		}

		return teams;
	}

	async listVenues(
		tournamentSlug: string,
	): Promise<readonly SportsDataVenueDTO[]> {
		const config = this.resolveConfig(tournamentSlug);
		const raw = await this.client.fetchPage(config);
		const { rows } = await import("./lpf-web.parser").then((m) =>
			Promise.resolve(m.parseLpfPage(raw)),
		);

		const seen = new Set<string>();
		const venues: SportsDataVenueDTO[] = [];

		for (const row of rows) {
			if (!row.venueName) continue;
			const slug = slugify(row.venueName);
			const externalId = `lpf-web-venue:${slug}`;
			if (!seen.has(externalId)) {
				seen.add(externalId);
				venues.push({
					externalId,
					name: row.venueName,
					city: null,
					countryCode: null,
					capacity: null,
				});
			}
		}

		return venues;
	}

	async listFixtures(
		tournamentSlug: string,
	): Promise<readonly SportsDataFixtureDTO[]> {
		const config = this.resolveConfig(tournamentSlug);
		const raw = await this.client.fetchPage(config);
		const { rows } = await import("./lpf-web.parser").then((m) =>
			Promise.resolve(m.parseLpfPage(raw)),
		);

		const fixtures: SportsDataFixtureDTO[] = [];

		for (const row of rows) {
			fixtures.push({
				externalId: this.fixtureId(tournamentSlug, row),
				homeTeamExternalId: `lpf-web-team:${slugify(row.homeTeamName)}`,
				awayTeamExternalId: `lpf-web-team:${slugify(row.awayTeamName)}`,
				venueExternalId: row.venueName
					? `lpf-web-venue:${slugify(row.venueName)}`
					: null,
				kickoffAt: row.kickoffAt,
				stage: null,
				groupName: null,
			});
		}

		return fixtures;
	}

	async listFinalResults(
		tournamentSlug: string,
	): Promise<readonly SportsDataFinalResultDTO[]> {
		const config = this.resolveConfig(tournamentSlug);
		const raw = await this.client.fetchPage(config);
		const { rows } = await import("./lpf-web.parser").then((m) =>
			Promise.resolve(m.parseLpfPage(raw)),
		);

		const results: SportsDataFinalResultDTO[] = [];

		for (const row of rows) {
			if (!row.isFinalEligible) continue;
			results.push({
				externalMatchId: this.fixtureId(tournamentSlug, row),
				homeScore: row.homeScore!,
				awayScore: row.awayScore!,
				playedAt: row.kickoffAt,
			});
		}

		return results;
	}

	/** Derives a deterministic fixture external ID. */
	private fixtureId(
		tournamentSlug: string,
		row: { dateLabel: string; homeTeamName: string; awayTeamName: string },
	): string {
		return [
			"lpf-web",
			tournamentSlug,
			row.dateLabel,
			slugify(row.homeTeamName),
			slugify(row.awayTeamName),
		].join(":");
	}

	/** Resolves a short name for a team from its full name. */
	private resolveShortName(name: string): string {
		const words = name.split(/\s+/).filter((w) => w.length > 0);
		if (words.length === 1)
			return name
				.replace(/[^A-Za-z0-9]/g, "")
				.slice(0, 3)
				.toUpperCase();
		if (words.length === 2)
			return words.map((w) => w[0]?.toUpperCase() ?? "").join("");
		const initials = words.map((w) => w[0]?.toUpperCase() ?? "");
		return [initials[0], initials.at(-1)].join("");
	}
}
