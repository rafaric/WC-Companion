import type { LpfWebTournamentConfigMap } from "./lpf-web.types";

/**
 * Tournament configurations for the LPF web provider.
 * Maps slug → official LPF tournament page URL and display name.
 */
export const LPF_WEB_TOURNAMENT_CONFIGS = {
	"liga-argentina-2026": {
		url: "/torneo-apertura-2026/",
		optaCompetitionId: 384,
		optaSeasonId: 2026,
		displayName: "Torneo Apertura Mercado Libre 2026",
	},
} as const satisfies LpfWebTournamentConfigMap;
