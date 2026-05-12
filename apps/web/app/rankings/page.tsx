import { auth0 } from "@/lib/auth0";
import {
  getCurrentUserProfile,
  getGlobalRanking,
  type CurrentUserProfile,
  type RankingEntry,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { buildPageMetadata } from "@/lib/metadata";
import { getFriendlyDisplayName } from "@/lib/user-display";

export const metadata = buildPageMetadata({
  title: "Rankings",
  description: "Compare football prediction points, exact picks, and tournament standings across the active leaderboard.",
  index: false,
  path: "/rankings",
});

function RankingRow({ entry, isCurrentUser }: { entry: RankingEntry; isCurrentUser: boolean }) {
  return (
    <li
      className={cn(
        "flex items-start justify-between gap-4 rounded-2xl border px-4 py-3",
        isCurrentUser ? "border-cyan-400/40 bg-cyan-400/10" : "border-slate-800 bg-slate-950/60",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-white">
            #{entry.position} {entry.username}
          </p>
          {isCurrentUser ? (
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              You
            </span>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          {entry.exactPredictions} exact · {entry.predictionsCount} predictions
        </p>
      </div>
      <p className="text-lg font-black text-cyan-300">{entry.totalPoints} pts</p>
    </li>
  );
}

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
              Full leaderboard
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Global ranking</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Compare points, exact predictions, and prediction counts across the active tournament.
            </p>
          </div>

          {currentUserRankingEntry ? (
            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Your standing</p>
                  <p className="mt-1 text-2xl font-black text-white">#{currentUserRankingEntry.position}</p>
                </div>
                <p className="text-sm font-medium text-cyan-100">{currentUserRankingEntry.totalPoints} points</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Exact predictions</p>
                  <p className="mt-1 text-lg font-bold text-white">{currentUserRankingEntry.exactPredictions}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Predictions</p>
                  <p className="mt-1 text-lg font-bold text-white">{currentUserRankingEntry.predictionsCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Username</p>
                  <p className="mt-1 text-lg font-bold text-white">{displayName}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ranking</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Current positions</h2>
              </div>
              <p className="text-sm text-slate-400">{ranking.length} players</p>
            </div>

            {ranking.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {ranking.map((entry) => (
                  <RankingRow
                    key={entry.userId}
                    entry={entry}
                    isCurrentUser={entry.userId === currentUserProfile?.id}
                  />
                ))}
              </ul>
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
