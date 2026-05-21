import type {
	LpfWebClientLike,
	LpfWebClientOptions,
	LpfWebTournamentConfig,
} from "./lpf-web.types";

const DEFAULT_BASE_URL = "https://omo.akamai.opta.net/auth";
const DEFAULT_WIDGET_JS_URL =
	"https://secure.widget.cloud.opta.net/v3/v3.opta-widgets.js";
const LPF_REFERER_URL = "https://www.ligaprofesional.ar/";

/**
 * HTTP client for fetching the official LPF fixture feed used by the embedded Opta widget.
 * Auto-discovers public OMO credentials from the Opta widget JS when env overrides are absent.
 * Mirrors the api-sports client pattern: injectable fetch, default/override base URL.
 */
export class LpfWebClient implements LpfWebClientLike {
	private readonly baseUrl: string;
	private readonly widgetJsUrl: string;
	private cachedCredentials: { user: string; password: string } | null = null;

	constructor(private readonly options: LpfWebClientOptions = {}) {
		this.baseUrl = options.baseUrl?.trim() || DEFAULT_BASE_URL;
		this.widgetJsUrl = options.widgetJsUrl?.trim() || DEFAULT_WIDGET_JS_URL;
	}

	async fetchPage(config: LpfWebTournamentConfig): Promise<string> {
		const fetchImpl = this.options.fetchImpl ?? fetch;
		const credentials = await this.resolveCredentials(fetchImpl);
		const url = this.buildFixtureFeedUrl(config, credentials);
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

	/**
	 * Resolves OMO credentials.
	 * - If both omoUser and omoPassword are provided, use them (env override).
	 * - Otherwise auto-discover from the public Opta widget JS and cache per instance.
	 */
	private async resolveCredentials(
		fetchImpl: typeof fetch,
	): Promise<{ user: string; password: string }> {
		const omoUser = this.options.omoUser?.trim();
		const omoPassword = this.options.omoPassword?.trim();

		// Both must be present for env override to win.
		if (omoUser && omoPassword) {
			return { user: omoUser, password: omoPassword };
		}

		// Use cached if already discovered.
		if (this.cachedCredentials) {
			return this.cachedCredentials;
		}

		// Otherwise auto-discover from widget JS.
		this.cachedCredentials = await this.discoverCredentials(fetchImpl);
		return this.cachedCredentials;
	}

	/**
	 * Fetches the public Opta widget JS and extracts omo_username / omo_password.
	 */
	private async discoverCredentials(
		fetchImpl: typeof fetch,
	): Promise<{ user: string; password: string }> {
		const response = await fetchImpl(this.widgetJsUrl, {
			headers: { Accept: "application/javascript,*/*" },
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch Opta widget JS for credential discovery: ${response.status}`,
			);
		}

		const text = await response.text();
		const userMatch = text.match(/this\.omo_username\s*=\s*"([^"]+)"/);
		const pswMatch = text.match(/this\.omo_password\s*=\s*"([^"]+)"/);

		if (!userMatch || !pswMatch) {
			throw new Error("Could not auto-discover OMO credentials from widget JS");
		}

		return { user: userMatch[1]!, password: pswMatch[1]! };
	}

	private buildFixtureFeedUrl(
		config: LpfWebTournamentConfig,
		credentials: { user: string; password: string },
	): string {
		const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/competition.php`);
		url.searchParams.set("feed_type", "f1");
		url.searchParams.set("competition", String(config.optaCompetitionId));
		url.searchParams.set("season_id", String(config.optaSeasonId));
		url.searchParams.set("user", credentials.user);
		url.searchParams.set("psw", credentials.password);
		return url.toString();
	}
}
