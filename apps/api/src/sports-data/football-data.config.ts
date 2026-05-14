import type { FootballDataTournamentConfigMap } from './football-data.types';

export const FOOTBALL_DATA_TOURNAMENT_CONFIGS = {
  // Provider-backed real tournament (ACTIVE in seed) - used by sync service
  'world-cup-2026': {
    competitionId: 2000,
    season: 2026,
    displayName: 'World Cup 2026',
  },
  // Demo tournament (FINISHED in seed) - not used by sync service
  'world-cup-2026-demo': {
    competitionId: 2000,
    season: 2026,
    displayName: 'World Cup 2026 Demo',
  },
} as const satisfies FootballDataTournamentConfigMap;
