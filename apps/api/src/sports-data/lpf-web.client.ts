import type {
	LpfWebClientLike,
	LpfWebClientOptions,
	LpfWebTournamentConfig,
} from "./lpf-web.types";

const DEFAULT_BASE_URL = "https://omo.akamai.opta.net/auth";
const LPF_REFERER_URL = "https://www.ligaprofesional.ar/";

/**
 * HTTP client for fetching the official LPF fixture feed used by the embedded Opta widget.
 * Mirrors the api-sports client pattern: injectable fetch, default/override base URL.
 */
export class LpfWebClient implements LpfWebClientLike {
	private readonly baseUrl: string;

	constructor(private readonly options: LpfWebClientOptions = {}) {
		this.baseUrl = options.baseUrl?.trim() || DEFAULT_BASE_URL;
	}

	async fetchPage(config: LpfWebTournamentConfig): Promise<string> {
		const fetchImpl = this.options.fetchImpl ?? fetch;
		const url = this.buildFixtureFeedUrl(config);
		const response = await fetchImpl(url, {
			headers: {
				Accept: "application/xml,text/xml,*/*",
				Referer: LPF_REFERER_URL,
			},
		});

		if (!response.ok) {
			throw new Error(
				`LPF fixture feed request failed with status ${response.status}`,
			);
		}

		return (await response.text()) as string;
	}

	private buildFixtureFeedUrl(config: LpfWebTournamentConfig): string {
		const omoUser = this.options.omoUser?.trim();
		const omoPassword = this.options.omoPassword?.trim();
		if (!omoUser || !omoPassword) {
			throw new Error("LPF web OMO credentials are required to fetch fixture feed");
		}

		const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/competition.php`);
		url.searchParams.set("feed_type", "f1");
		url.searchParams.set("competition", String(config.optaCompetitionId));
		url.searchParams.set("season_id", String(config.optaSeasonId));
		url.searchParams.set("user", omoUser);
		url.searchParams.set("psw", omoPassword);
		return url.toString();
	}
}
