import type { FootballDataTournamentConfigMap } from './football-data.types';

export const FOOTBALL_DATA_TOURNAMENT_CONFIGS = {
  'world-cup-2026-demo': {
    competitionId: 2000,
    season: 2026,
    displayName: 'World Cup 2026 Demo',
  },
} as const satisfies FootballDataTournamentConfigMap;
