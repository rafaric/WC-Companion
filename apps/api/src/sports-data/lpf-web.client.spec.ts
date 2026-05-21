import { LpfWebClient } from "./lpf-web.client";
import { LPF_WEB_TOURNAMENT_CONFIGS } from "./lpf-web.config";

const LIGA_CONFIG = LPF_WEB_TOURNAMENT_CONFIGS["liga-argentina-2026"];

const WIDGET_JS_SAMPLE =
	'some.minified.js(this.omo_username = "public-widget-user"; this.omo_password = "public-widget-password";).more';

const makeMockFetch = (
	body: string,
	options: { ok?: boolean; status?: number } = {},
): jest.MockedFunction<typeof fetch> => {
	const mock = jest.fn(async () => ({
		ok: options.ok ?? true,
		status: options.status ?? 200,
		text: async () => body,
	}));
	return mock as unknown as jest.MockedFunction<typeof fetch>;
};

const makeErrorMockFetch = (
	status: number,
): jest.MockedFunction<typeof fetch> => {
	const mock = jest.fn(async () => ({
		ok: false,
		status,
		text: async () => "server error",
	}));
	return mock as unknown as jest.MockedFunction<typeof fetch>;
};

/**
 * Creates a mock fetch that returns different bodies based on the URL,
 * for testing multi-step flows (e.g., widget JS discovery + fixture feed).
 */
function makeChainedMockFetch(
	steps: Array<{ urlPattern: string | RegExp; body: string; ok?: boolean; status?: number }>,
): jest.MockedFunction<typeof fetch> {
	return jest.fn(async (url) => {
		const urlStr = String(url);
		const step = steps.find((s) =>
			typeof s.urlPattern === "string"
				? urlStr.includes(s.urlPattern)
				: s.urlPattern.test(urlStr),
		);
		return {
			ok: step?.ok ?? true,
			status: step?.status ?? 200,
			text: async () => step?.body ?? "",
		};
	}) as unknown as jest.MockedFunction<typeof fetch>;
}

describe("LpfWebClient", () => {
	function createClientWithOverrides(
		fetchImpl: jest.MockedFunction<typeof fetch>,
		overrides: { baseUrl?: string; omoUser?: string; omoPassword?: string; widgetJsUrl?: string } = {},
	): LpfWebClient {
		return new LpfWebClient({
			baseUrl: "https://omo.akamai.opta.net/auth",
			fetchImpl,
			omoUser: "test-user",
			omoPassword: "test-password",
			...overrides,
		});
	}

	// ─── Env override tests ────────────────────────────────────────────────────

	describe("fetchPage with env override", () => {
		it("uses explicit omoUser/omoPassword without triggering discovery", async () => {
			const fetchImpl = makeMockFetch("<SoccerDocument />");
			const client = createClientWithOverrides(fetchImpl);

			await client.fetchPage(LIGA_CONFIG);

			const [url] = fetchImpl.mock.calls[0]!;
			expect(String(url)).toContain("user=test-user");
			expect(String(url)).toContain("psw=test-password");
		});

		it("fetches the configured Opta fixture feed with overrides", async () => {
			const fetchImpl = makeMockFetch("<SoccerDocument />");
			const client = createClientWithOverrides(fetchImpl);

			await client.fetchPage(LIGA_CONFIG);

			const [url, init] = fetchImpl.mock.calls[0]!;
			expect(String(url)).toMatch(
				/^https:\/\/omo\.akamai\.opta\.net\/auth\/competition\.php/,
			);
			expect(String(url)).toContain("feed_type=f1");
			expect(String(url)).toContain("competition=384");
			expect(String(url)).toContain("season_id=2026");
			expect(init).toEqual({
				headers: {
					Accept: "application/xml,text/xml,*/*",
					Referer: "https://www.ligaprofesional.ar/",
				},
			});
		});

		it("returns fixture feed text on success", async () => {
			const xml = "<SoccerDocument>LPF fixture feed</SoccerDocument>";
			const fetchImpl = makeMockFetch(xml);
			const client = createClientWithOverrides(fetchImpl);

			const result = await client.fetchPage(LIGA_CONFIG);

			expect(result).toBe(xml);
		});

		it("throws on non-OK fixture feed response", async () => {
			const fetchImpl = makeErrorMockFetch(404);
			const client = createClientWithOverrides(fetchImpl);

			await expect(client.fetchPage(LIGA_CONFIG)).rejects.toThrow(
				"LPF fixture feed request failed with status 404",
			);
		});

		it("throws on server error fixture feed response", async () => {
			const fetchImpl = makeErrorMockFetch(500);
			const client = createClientWithOverrides(fetchImpl);

			await expect(client.fetchPage(LIGA_CONFIG)).rejects.toThrow(
				"LPF fixture feed request failed with status 500",
			);
		});
	});

	// ─── Auto-discovery tests ────────────────────────────────────────────────

	describe("auto-discoverCredentials", () => {
		it("discovers credentials from widget JS when omoUser/omoPassword are absent", async () => {
			const chainedFetch = makeChainedMockFetch([
				{ urlPattern: "opta-widgets.js", body: WIDGET_JS_SAMPLE },
				{ urlPattern: "competition.php", body: "<SoccerDocument />" },
			]);

			const client = new LpfWebClient({ fetchImpl: chainedFetch });

			await client.fetchPage(LIGA_CONFIG);

			expect(chainedFetch).toHaveBeenCalledTimes(2);
			const [widgetUrl] = chainedFetch.mock.calls[0]!;
			expect(String(widgetUrl)).toContain("opta-widgets.js");

			const [fixtureUrl] = chainedFetch.mock.calls[1]!;
			expect(String(fixtureUrl)).toContain("user=public-widget-user");
			expect(String(fixtureUrl)).toContain("psw=public-widget-password");
		});

		it("uses env overrides when both omoUser and omoPassword are provided", async () => {
			const chainedFetch = makeChainedMockFetch([
				{ urlPattern: "opta-widgets.js", body: WIDGET_JS_SAMPLE },
				{ urlPattern: "competition.php", body: "<SoccerDocument />" },
			]);

			const client = new LpfWebClient({
				fetchImpl: chainedFetch,
				omoUser: "env-user",
				omoPassword: "env-password",
			});

			await client.fetchPage(LIGA_CONFIG);

			// No widget JS call — overrides take precedence
			expect(chainedFetch).toHaveBeenCalledTimes(1);
			const [fixtureUrl] = chainedFetch.mock.calls[0]!;
			expect(String(fixtureUrl)).toContain("user=env-user");
			expect(String(fixtureUrl)).toContain("psw=env-password");
		});

		it("caches discovered credentials across multiple fetchPage calls", async () => {
			let fixtureCallCount = 0;
			const chainedFetch = jest.fn(async (url) => {
				const urlStr = String(url);
				if (urlStr.includes("opta-widgets.js")) {
					return { ok: true, status: 200, text: async () => WIDGET_JS_SAMPLE };
				}
				fixtureCallCount++;
				return { ok: true, status: 200, text: async () => "<SoccerDocument />" };
			}) as unknown as jest.MockedFunction<typeof fetch>;

			const client = new LpfWebClient({ fetchImpl: chainedFetch });

			await client.fetchPage(LIGA_CONFIG);
			await client.fetchPage(LIGA_CONFIG);

			// 1 widget JS fetch (cached), then 2 fixture fetches
			expect(chainedFetch).toHaveBeenCalledTimes(3);
			expect(fixtureCallCount).toBe(2);
		});

		it("throws when widget JS fetch fails", async () => {
			const fetchImpl = makeErrorMockFetch(404);
			const client = new LpfWebClient({ fetchImpl });

			await expect(client.fetchPage(LIGA_CONFIG)).rejects.toThrow(
				/Failed to fetch Opta widget JS/,
			);
		});

		it("throws when widget JS does not contain credential patterns", async () => {
			const fetchImpl = makeMockFetch("var someConfig = { public: true };");
			const client = new LpfWebClient({ fetchImpl });

			await expect(client.fetchPage(LIGA_CONFIG)).rejects.toThrow(
				/Could not auto-discover OMO credentials from widget JS/,
			);
		});

		it("uses custom widgetJsUrl when provided", async () => {
			const chainedFetch = makeChainedMockFetch([
				{
					urlPattern: "custom.example.com/opta-widgets.js",
					body: WIDGET_JS_SAMPLE,
				},
				{ urlPattern: "competition.php", body: "<SoccerDocument />" },
			]);

			const client = new LpfWebClient({
				fetchImpl: chainedFetch,
				widgetJsUrl: "https://custom.example.com/opta-widgets.js",
			});

			await client.fetchPage(LIGA_CONFIG);

			expect(chainedFetch).toHaveBeenCalledTimes(2);
			const [widgetUrl] = chainedFetch.mock.calls[0]!;
			expect(String(widgetUrl)).toContain("custom.example.com/opta-widgets.js");
		});
	});
});