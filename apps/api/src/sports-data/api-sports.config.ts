import type { ApiSportsTournamentConfigMap } from "./api-sports.types";

/**
 * Tournament configurations for the api-sports provider.
 * Maps slug → league ID and season as used by v3.football.api-sports.io.
 */
export const API_SPORTS_TOURNAMENT_CONFIGS = {
	"liga-argentina-2026": {
		leagueId: 128,
		season: 2026,
		displayName: "Liga Profesional Argentina 2026",
	},
} as const satisfies ApiSportsTournamentConfigMap;
