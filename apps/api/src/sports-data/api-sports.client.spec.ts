import { ApiSportsClient } from "./api-sports.client";
import { API_SPORTS_TOURNAMENT_CONFIGS } from "./api-sports.config";

const LIGA_2026_CONFIG = API_SPORTS_TOURNAMENT_CONFIGS["liga-argentina-2026"];

// Helper: creates a jest mock of `typeof fetch` returning 200 OK with given body.
const makeMockFetch = (body: unknown): jest.MockedFunction<typeof fetch> => {
	const mock = jest.fn(async () => ({
		ok: true,
		json: async () => body,
	}));
	return mock as unknown as jest.MockedFunction<typeof fetch>;
};

// Helper: creates a jest mock of `typeof fetch` returning a non-OK response.
const makeErrorMockFetch = (
	status: number,
): jest.MockedFunction<typeof fetch> => {
	const mock = jest.fn(async () => ({
		ok: false,
		status,
		text: async () => "error",
	}));
	return mock as unknown as jest.MockedFunction<typeof fetch>;
};

describe("ApiSportsClient", () => {
	// ─────────────────────────────────────────────────────────────────────────────
	// RED — initial failing assertions (written before or alongside implementation)
	// ─────────────────────────────────────────────────────────────────────────────

	describe("path building", () => {
		it("builds /teams path with league and season", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({ fetchImpl });

			await client.listTeams(LIGA_2026_CONFIG);

			expect(fetchImpl).toHaveBeenCalledWith(
				"https://v3.football.api-sports.io/teams?league=128&season=2026",
				expect.objectContaining({ headers: expect.any(Object) }),
			);
		});

		it("builds /fixtures path with league and season", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({ fetchImpl });

			await client.listFixtures(LIGA_2026_CONFIG);

			expect(fetchImpl).toHaveBeenCalledWith(
				"https://v3.football.api-sports.io/fixtures?league=128&season=2026",
				expect.objectContaining({ headers: expect.any(Object) }),
			);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────────
	// GREEN — full test coverage
	// ─────────────────────────────────────────────────────────────────────────────

	describe("base URL", () => {
		it("uses default base URL when no override", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({ fetchImpl });
			await client.listTeams(LIGA_2026_CONFIG);

			const [url] = fetchImpl.mock.calls[0]!;
			expect(url).toMatch(/^https:\/\/v3\.football\.api-sports\.io/);
		});

		it("honors API_SPORTS_BASE_URL override", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({
				baseUrl: "https://custom.api-sports.io",
				fetchImpl,
			});
			await client.listTeams(LIGA_2026_CONFIG);

			const [url] = fetchImpl.mock.calls[0]!;
			expect(url).toMatch(/^https:\/\/custom\.api-sports\.io/);
		});
	});

	describe("authentication", () => {
		it("sends x-apisports-key header with trimmed api key", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({
				apiKey: "  my-secret-key  ",
				fetchImpl,
			});
			await client.listTeams(LIGA_2026_CONFIG);

			const [, init] = fetchImpl.mock.calls[0]!;
			const headers = init!.headers as Record<string, string>;
			expect(headers["x-apisports-key"]).toBe("my-secret-key");
		});

		it("omits x-apisports-key header when apiKey is empty", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({ apiKey: "", fetchImpl });
			await client.listTeams(LIGA_2026_CONFIG);

			const [, init] = fetchImpl.mock.calls[0]!;
			const headers = init!.headers as Record<string, string>;
			expect(headers["x-apisports-key"]).toBeUndefined();
		});

		it("omits x-apisports-key header when apiKey is undefined", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({ apiKey: undefined, fetchImpl });
			await client.listTeams(LIGA_2026_CONFIG);

			const [, init] = fetchImpl.mock.calls[0]!;
			const headers = init!.headers as Record<string, string>;
			expect(headers["x-apisports-key"]).toBeUndefined();
		});
	});

	describe("request behavior", () => {
		it("includes Accept: application/json header on every request", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({ fetchImpl });
			await client.listTeams(LIGA_2026_CONFIG);

			const [, init] = fetchImpl.mock.calls[0]!;
			const headers = init!.headers as Record<string, string>;
			expect(headers["Accept"]).toBe("application/json");
		});

		it("throws on non-OK response", async () => {
			const fetchImpl = makeErrorMockFetch(401);
			const client = new ApiSportsClient({ apiKey: "bad-key", fetchImpl });
			await expect(client.listTeams(LIGA_2026_CONFIG)).rejects.toThrow(
				"api-sports.io request failed with status 401",
			);
		});
	});

	// ─────────────────────────────────────────────────────────────────────────────
	// TRIANGULATE — edge cases
	// ─────────────────────────────────────────────────────────────────────────────

	describe("edge cases", () => {
		it("trims whitespace from api key", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({
				apiKey: "  key-with-spaces  ",
				fetchImpl,
			});
			await client.listTeams(LIGA_2026_CONFIG);

			const [, init] = fetchImpl.mock.calls[0]!;
			const headers = init!.headers as Record<string, string>;
			expect(headers["x-apisports-key"]).toBe("key-with-spaces");
		});

		it("encodes leagueId and season as query params", async () => {
			const fetchImpl = makeMockFetch({ response: [] });
			const client = new ApiSportsClient({ fetchImpl });
			await client.listTeams(LIGA_2026_CONFIG);

			const [url] = fetchImpl.mock.calls[0]!;
			expect(url).toContain("league=128");
			expect(url).toContain("season=2026");
		});
	});
});
