import { LpfWebClient } from "./lpf-web.client";
import { LPF_WEB_TOURNAMENT_CONFIGS } from "./lpf-web.config";

const LIGA_CONFIG = LPF_WEB_TOURNAMENT_CONFIGS["liga-argentina-2026"];

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

describe("LpfWebClient", () => {
	function createClient(
		fetchImpl: jest.MockedFunction<typeof fetch>,
		baseUrl?: string,
	): LpfWebClient {
		return new LpfWebClient({
			baseUrl,
			fetchImpl,
			omoUser: "test-user",
			omoPassword: "test-password",
		});
	}

	describe("fetchPage", () => {
		it("fetches the configured Opta fixture feed", async () => {
			const fetchImpl = makeMockFetch("<SoccerDocument />");
			const client = createClient(fetchImpl);

			await client.fetchPage(LIGA_CONFIG);

			const [url, init] = fetchImpl.mock.calls[0]!;
			expect(String(url)).toMatch(
				/^https:\/\/omo\.akamai\.opta\.net\/auth\/competition\.php/,
			);
			expect(String(url)).toContain("feed_type=f1");
			expect(String(url)).toContain("competition=384");
			expect(String(url)).toContain("season_id=2026");
			expect(String(url)).toContain("user=test-user");
			expect(String(url)).toContain("psw=test-password");
			expect(init).toEqual({
				headers: {
					Accept: "application/xml,text/xml,*/*",
					Referer: "https://www.ligaprofesional.ar/",
				},
			});
		});

		it("uses default OMO base URL when no override", async () => {
			const fetchImpl = makeMockFetch("<SoccerDocument />");
			const client = createClient(fetchImpl);

			await client.fetchPage(LIGA_CONFIG);

			const [url] = fetchImpl.mock.calls[0]!;
			expect(url).toMatch(/^https:\/\/omo\.akamai\.opta\.net\/auth/);
		});

		it("honors baseUrl override", async () => {
			const fetchImpl = makeMockFetch("<SoccerDocument />");
			const client = createClient(fetchImpl, "https://custom.lpf.test/auth");

			await client.fetchPage(LIGA_CONFIG);

			const [url] = fetchImpl.mock.calls[0]!;
			expect(url).toMatch(/^https:\/\/custom\.lpf\.test\/auth/);
		});

		it("returns fixture feed text on success", async () => {
			const xml = "<SoccerDocument>LPF fixture feed</SoccerDocument>";
			const fetchImpl = makeMockFetch(xml);
			const client = createClient(fetchImpl);

			const result = await client.fetchPage(LIGA_CONFIG);

			expect(result).toBe(xml);
		});

		it("throws when OMO credentials are missing", async () => {
			const fetchImpl = makeMockFetch("<SoccerDocument />");
			const client = new LpfWebClient({ fetchImpl });

			await expect(client.fetchPage(LIGA_CONFIG)).rejects.toThrow(
				"LPF web OMO credentials are required to fetch fixture feed",
			);
		});

		it("throws on non-OK response", async () => {
			const fetchImpl = makeErrorMockFetch(404);
			const client = createClient(fetchImpl);

			await expect(client.fetchPage(LIGA_CONFIG)).rejects.toThrow(
				"LPF fixture feed request failed with status 404",
			);
		});

		it("throws on server error response", async () => {
			const fetchImpl = makeErrorMockFetch(500);
			const client = createClient(fetchImpl);

			await expect(client.fetchPage(LIGA_CONFIG)).rejects.toThrow(
				"LPF fixture feed request failed with status 500",
			);
		});
	});
});
