import { auth0 } from "@/lib/auth0";
import {
  getCurrentUserProfile,
  getGlobalRanking,
  type CurrentUserProfile,
  type RankingEntry,
} from "@/lib/api";
import { buildPageMetadata } from "@/lib/metadata";
import { getFriendlyDisplayName } from "@/lib/user-display";
import { RankingList } from "./ranking-list";

export const metadata = buildPageMetadata({
  title: "Rankings",
  description: "Compare World Cup prediction points, exact picks, and standings across the active leaderboard.",
  index: false,
  path: "/rankings",
});

const VISIBLE_RANKING_LIMIT = 10;

export default async function RankingsPage() {
  const session = await auth0.getSession();
  const rankingPromise = getGlobalRanking().catch(() => [] as RankingEntry[]);

  let currentUserProfile: CurrentUserProfile | null = null;

  if (session) {
    try {
      const { token } = await auth0.getAccessToken();
      currentUserProfile = await getCurrentUserProfile(token);
    } catch {
      currentUserProfile = null;
    }
  }

  const ranking = await rankingPromise;
  const currentUserRankingEntry = currentUserProfile
    ? ranking.find((entry) => entry.userId === currentUserProfile.id) ?? null
    : null;
  const displayName = session ? getFriendlyDisplayName(session.user, currentUserProfile) : "You";

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl">
      <section className="space-y-6 py-2 sm:py-4">
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              World Cup leaderboard
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">World Cup ranking</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Compare points, exact picks, and prediction volume across everyone playing this World Cup.
            </p>
          </div>

          {currentUserRankingEntry ? (
            <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-slate-900/80 to-violet-400/10 p-4 shadow-xl shadow-cyan-950/20">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/30 bg-slate-950/70 shadow-lg shadow-cyan-500/10">
                    <span className="text-2xl font-black text-cyan-200">#{currentUserRankingEntry.position}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Your standing</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">{displayName}</p>
                    <p className="text-xs text-cyan-100/70">Your place in the World Cup board</p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Points</p>
                  <p className="mt-1 text-3xl font-black tabular-nums text-white">{currentUserRankingEntry.totalPoints}</p>
                  <p className="text-xs font-semibold text-cyan-100/70">pts</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Exact picks</p>
                  <p className="mt-1 text-xl font-black text-white">{currentUserRankingEntry.exactPredictions}</p>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-center">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Predictions</p>
                  <p className="mt-1 text-xl font-black text-white">{currentUserRankingEntry.predictionsCount}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ranking</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Top World Cup positions</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Showing the top {Math.min(VISIBLE_RANKING_LIMIT, ranking.length)} players. Your standing stays visible above.
                </p>
              </div>
              <p className="text-sm text-slate-400">{ranking.length} players</p>
            </div>

            {ranking.length > 0 ? (
              <RankingList
                currentUserDisplayName={displayName}
                currentUserId={currentUserProfile?.id ?? null}
                currentUserRankingEntry={currentUserRankingEntry}
                ranking={ranking}
              />
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                No global ranking data yet. Once scores are recorded, positions will appear here.
              </div>
            )}
          </div>
      </section>
    </main>
  );
}
