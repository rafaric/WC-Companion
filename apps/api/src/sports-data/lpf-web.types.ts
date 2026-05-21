/**
 * LPF website scraper types and interfaces.
 * Models the minimal surfaces needed by the lpf-web client and parser.
 */

/** Configuration for a single tournament served by the LPF web provider. */
export interface LpfWebTournamentConfig {
	/** URL to the official LPF tournament page (e.g. /torneo-apertura-2026/). */
	url: string;
	/** Opta competition id embedded in the official LPF widget. */
	optaCompetitionId: number;
	/** Opta season id embedded in the official LPF widget. */
	optaSeasonId: number;
	displayName: string;
}

/** Map of tournament slug → configuration for the LPF web provider. */
export type LpfWebTournamentConfigMap = Readonly<
	Record<string, LpfWebTournamentConfig>
>;

/** Options for instantiating the LpfWebClient. */
export interface LpfWebClientOptions {
	/** Optional OMO base URL override for testing or local config. */
	baseUrl?: string;
	/**
	 * Optional OMO username. When provided together with omoPassword, used directly
	 * (env override). When absent, auto-discovered from the public Opta widget JS.
	 */
	omoUser?: string;
	/**
	 * Optional OMO password. When provided together with omoUser, used directly
	 * (env override). When absent, auto-discovered from the public Opta widget JS.
	 */
	omoPassword?: string;
	/**
	 * URL of the Opta widget JS that contains the public OMO credentials.
	 * Override for testing or if the default public endpoint changes.
	 */
	widgetJsUrl?: string;
	/** Optional injectable fetch for testing. */
	fetchImpl?: typeof fetch;
}

/** Interface that LpfWebProvider consumes from the client. */
export interface LpfWebClientLike {
	/**
	 * Fetches the raw LPF fixture feed for the given tournament.
	 * Returns Opta XML as a string.
	 */
	fetchPage(config: LpfWebTournamentConfig): Promise<string>;
}

/** Status tokens found in LPF match rows. */
export type LpfMatchStatus = "TC" | "TE+P" | "NS" | "1H" | "2H" | string;

/**
 * A single normalized match row parsed from the LPF page.
 * Represents one match including its current status, teams, scores, and context.
 */
export interface LpfWebMatchRow {
	/** Raw status token from the page, e.g. "TC" (tiempo cumplido) or "TE+P" (tiempo extra + penales). */
	status: LpfMatchStatus;
	/**
	 * Whether this row represents a final result that should be treated as a scored match.
	 * True only when status === "TC" and both scores are numeric.
	 * TE+P rows are parsed but marked ineligible for final-results import.
	 */
	isFinalEligible: boolean;
	/** ISO date string of the match (YYYY-MM-DD) derived from the page date heading. */
	dateLabel: string;
	/** Parsed kickoff date. Throws if the constructed date is invalid. */
	kickoffAt: Date;
	/** Canonical home team name as it appears on the LPF page. */
	homeTeamName: string;
	/** Canonical away team name as it appears on the LPF page. */
	awayTeamName: string;
	/** Home team score. `null` if not yet played or not available. */
	homeScore: number | null;
	/** Away team score. `null` if not yet played or not available. */
	awayScore: number | null;
	/** Venue name when available on the page. `null` if not present. */
	venueName: string | null;
	/** Free-text note beneath the match row when present, e.g. penalty result details. */
	note: string | null;
}

/**
 * The result of parsing the LPF page content.
 */
export interface LpfWebParseResult {
	/** All match rows found and parsed from the fixture section. */
	rows: readonly LpfWebMatchRow[];
	/** Number of rows skipped due to unparseable format. */
	skippedCount: number;
}
