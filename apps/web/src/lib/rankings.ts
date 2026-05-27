import type { RankingEntry } from "@/lib/api";

export const GLOBAL_RANKING_PREVIEW_LIMIT = 5 as const;

export function looksTechnicalUsername(username: string): boolean {
  const normalized = username.trim();

  return (
    /^\d+$/.test(normalized) ||
    /^[a-f0-9]{12,}$/i.test(normalized) ||
    /^[a-f0-9-]{20,}$/i.test(normalized) ||
    normalized.startsWith("auth0-")
  );
}

export function getRankingDisplayName(
  entry: RankingEntry,
  currentUserId: string | null,
  currentUserDisplayName: string,
  playerFallback: (position: number) => string,
): string {
  if (entry.userId === currentUserId) {
    return currentUserDisplayName;
  }

  if (looksTechnicalUsername(entry.username)) {
    return playerFallback(entry.position);
  }

  return entry.username;
}

export function getRankingPreview(
  ranking: RankingEntry[],
  currentUserId?: string | null,
  limit: number = GLOBAL_RANKING_PREVIEW_LIMIT,
): RankingEntry[] {
  const preview = ranking.slice(0, limit);

  if (!currentUserId) {
    return preview;
  }

  return preview.filter((entry) => entry.userId !== currentUserId);
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
