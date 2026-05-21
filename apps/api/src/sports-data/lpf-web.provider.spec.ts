import { NotFoundException } from "@nestjs/common";

import { SPORTS_DATA_PROVIDER_KEYS } from "./sports-data.constants";
import type { SportsDataProvider } from "./sports-data.types";
import { LpfWebProvider } from "./lpf-web.provider";
import { LPF_WEB_TOURNAMENT_CONFIGS } from "./lpf-web.config";

// ─── Representative Opta XML fixture data ───────────────────────────────────

const SAMPLE_OPTA_XML = `<SoccerDocument>
  <MatchData uID="g1">
    <MatchInfo Period="FullTime" MatchDay="1" Venue_id="2939">
      <DateUtc>2026-01-22 20:00:00</DateUtc>
    </MatchInfo>
    <Stat Type="Venue">José María Minella</Stat>
    <TeamData Score="2" Side="Home" TeamRef="t8621" />
    <TeamData Score="1" Side="Away" TeamRef="t8625" />
  </MatchData>
  <MatchData uID="g2">
    <MatchInfo Period="FullTime" MatchDay="2" Venue_id="4000">
      <DateUtc>2026-01-29 20:00:00</DateUtc>
    </MatchInfo>
    <Stat Type="Venue">Diego Armando Maradona</Stat>
    <TeamData Score="0" Side="Home" TeamRef="t8621" />
    <TeamData Score="3" Side="Away" TeamRef="t100" />
  </MatchData>
  <MatchData uID="g3">
    <MatchInfo Period="ShootOut" MatchDay="17" Venue_id="4000">
      <DateUtc>2026-05-17 20:00:00</DateUtc>
    </MatchInfo>
    <Stat Type="Venue">Diego Armando Maradona</Stat>
    <TeamData Score="1" Side="Home" TeamRef="t100" />
    <TeamData Score="1" Side="Away" TeamRef="t101" />
  </MatchData>
  <MatchData uID="g4">
    <MatchInfo Period="PreMatch" MatchDay="18">
      <DateUtc>2026-05-24 20:00:00</DateUtc>
    </MatchInfo>
    <TeamData Score="0" Side="Home" TeamRef="t101" />
    <TeamData Score="0" Side="Away" TeamRef="t8625" />
  </MatchData>
  <Team uID="t8621"><Name>Aldosivi</Name><ShortTeamName>Aldosivi</ShortTeamName></Team>
  <Team uID="t8625"><Name>Defensa y Justicia</Name><ShortTeamName>Def y Justicia</ShortTeamName></Team>
  <Team uID="t100"><Name>Argentinos Juniors</Name><ShortTeamName>Argentinos Jrs.</ShortTeamName></Team>
  <Team uID="t101"><Name>Belgrano</Name><ShortTeamName>Belgrano</ShortTeamName></Team>
</SoccerDocument>`;

describe("LpfWebProvider", () => {
	let provider: SportsDataProvider;

	beforeEach(() => {
		provider = new LpfWebProvider(
			{
				fetchPage: async () => SAMPLE_OPTA_XML,
			} as never,
			LPF_WEB_TOURNAMENT_CONFIGS,
		);
	});

	describe("providerKey", () => {
		it("exposes the lpf-web provider key", () => {
			expect(provider.providerKey).toBe(SPORTS_DATA_PROVIDER_KEYS.LPF_WEB);
		});
	});

	describe("listTeams", () => {
		it("returns distinct teams with deterministic external IDs", async () => {
			const teams = await provider.listTeams("liga-argentina-2026");

			expect(teams.length).toBeGreaterThan(0);
			expect(teams.every((t) => t.externalId.startsWith("lpf-web-team:"))).toBe(true);
		});

		it("includes home and away teams from every row", async () => {
			const teams = await provider.listTeams("liga-argentina-2026");
			const names = teams.map((t) => t.name);

			expect(names).toContain("Aldosivi");
			expect(names).toContain("Def y Justicia");
			expect(names).toContain("Argentinos Jrs.");
			expect(names).toContain("Belgrano");
		});

		it("returns teams with null countryCode, flagCode, primaryColor, secondaryColor", async () => {
			const teams = await provider.listTeams("liga-argentina-2026");
			for (const team of teams) {
				expect(team.countryCode).toBeNull();
				expect(team.flagCode).toBeNull();
				expect(team.primaryColor).toBeNull();
				expect(team.secondaryColor).toBeNull();
			}
		});

		it("throws NotFoundException for an unknown tournament slug", async () => {
			await expect(
				provider.listTeams("unknown-tournament"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("listVenues", () => {
		it("returns distinct venues with deterministic external IDs", async () => {
			const venues = await provider.listVenues("liga-argentina-2026");

			expect(venues.length).toBeGreaterThan(0);
			expect(
				venues.every((v) => v.externalId.startsWith("lpf-web-venue:")),
			).toBe(true);
		});

		it("includes venues from match rows that carry a venue name", async () => {
			const venues = await provider.listVenues("liga-argentina-2026");
			const names = venues.map((v) => v.name);

			expect(names).toContain("José María Minella");
			expect(names).toContain("Diego Armando Maradona");
		});

		it("sets city, countryCode, and capacity to null", async () => {
			const venues = await provider.listVenues("liga-argentina-2026");
			for (const venue of venues) {
				expect(venue.city).toBeNull();
				expect(venue.countryCode).toBeNull();
				expect(venue.capacity).toBeNull();
			}
		});

		it("throws NotFoundException for an unknown tournament slug", async () => {
			await expect(
				provider.listVenues("unknown-tournament"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("listFixtures", () => {
		it("maps every row to a fixture with a deterministic externalId", async () => {
			const fixtures = await provider.listFixtures("liga-argentina-2026");

			expect(fixtures.length).toBe(4);
			expect(
				fixtures.every((f) =>
					f.externalId.startsWith("lpf-web:liga-argentina-2026:"),
				),
			).toBe(true);
		});

		it("uses lpf-web-team slugs for home and away team external IDs", async () => {
			const fixtures = await provider.listFixtures("liga-argentina-2026");

			for (const fixture of fixtures) {
				expect(fixture.homeTeamExternalId).toMatch(/^lpf-web-team:/);
				expect(fixture.awayTeamExternalId).toMatch(/^lpf-web-team:/);
			}
		});

		it("uses venue external IDs that match the listVenues output", async () => {
			const fixtures = await provider.listFixtures("liga-argentina-2026");
			const venues = await provider.listVenues("liga-argentina-2026");

			for (const fixture of fixtures) {
				if (fixture.venueExternalId === null) continue;
				expect(
					venues.some((v) => v.externalId === fixture.venueExternalId),
				).toBe(true);
			}
		});

		it("sets stage and groupName to null", async () => {
			const fixtures = await provider.listFixtures("liga-argentina-2026");
			for (const fixture of fixtures) {
				expect(fixture.stage).toBeNull();
				expect(fixture.groupName).toBeNull();
			}
		});

		it("derives kickoffAt from the parsed row Date", async () => {
			const fixtures = await provider.listFixtures("liga-argentina-2026");
			const g1 = fixtures.find((f) => f.externalId.includes("2026-01-22"));
			expect(g1?.kickoffAt).toBeInstanceOf(Date);
		});

		it("throws NotFoundException for an unknown tournament slug", async () => {
			await expect(
				provider.listFixtures("unknown-tournament"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("listFinalResults", () => {
		it("returns only TC (FullTime) rows with numeric scores", async () => {
			const results = await provider.listFinalResults("liga-argentina-2026");

			// Only 2 FullTime matches: g1 (2-1) and g2 (0-3)
			expect(results).toHaveLength(2);
		});

		it("maps TC rows to correct scores", async () => {
			const results = await provider.listFinalResults("liga-argentina-2026");
			const g1 = results.find((r) => r.externalMatchId.includes("2026-01-22"));

			expect(g1?.homeScore).toBe(2);
			expect(g1?.awayScore).toBe(1);
		});

		it("skips ShootOut (TE+P) rows", async () => {
			const results = await provider.listFinalResults("liga-argentina-2026");
			const ids = results.map((r) => r.externalMatchId);

			// g3 is ShootOut on 2026-05-17; ensure it is absent
			expect(ids.some((id) => id.includes("2026-05-17"))).toBe(false);
		});

		it("skips PreMatch rows", async () => {
			const results = await provider.listFinalResults("liga-argentina-2026");
			const ids = results.map((r) => r.externalMatchId);

			// g4 is PreMatch on 2026-05-24
			expect(ids.some((id) => id.includes("2026-05-24"))).toBe(false);
		});

		it("sets playedAt to the row kickoffAt date", async () => {
			const results = await provider.listFinalResults("liga-argentina-2026");
			for (const result of results) {
				expect(result.playedAt).toBeInstanceOf(Date);
			}
		});

		it("throws NotFoundException for an unknown tournament slug", async () => {
			await expect(
				provider.listFinalResults("unknown-tournament"),
			).rejects.toThrow(NotFoundException);
		});
	});
});