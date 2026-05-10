import type { RankingEntry } from "@/lib/api";

export const GLOBAL_RANKING_PREVIEW_LIMIT = 5 as const;

export function getRankingPreview(
  ranking: RankingEntry[],
  limit: number = GLOBAL_RANKING_PREVIEW_LIMIT,
): RankingEntry[] {
  return ranking.slice(0, limit);
}

export function findRankingEntryByUserId(
  ranking: RankingEntry[],
  userId: string | null | undefined,
): RankingEntry | null {
  if (!userId) {
    return null;
  }

  return ranking.find((entry) => entry.userId === userId) ?? null;
}
