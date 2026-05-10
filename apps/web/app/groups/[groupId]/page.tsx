import Link from "next/link";
import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import { ApiError, getCurrentUserProfile, getGroupRanking, type RankingEntry } from "@/lib/api";
import { cn } from "@/lib/cn";

interface GroupDetailPageProps {
  params: Promise<{ groupId: string }>;
}

interface RankingStatsProps {
  label: string;
  value: number;
}

function RankingStats({ label, value }: RankingStatsProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-right">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}

function getRankingErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "You need group access to view this ranking.";
    }

    if (error.status === 404) {
      return "This group was not found.";
    }
  }

  return "We could not load this ranking right now.";
}

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
        <p className="text-xs text-slate-500">{entry.userId}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-right">
        <RankingStats label="Points" value={entry.totalPoints} />
        <RankingStats label="Exact" value={entry.exactPredictions} />
        <RankingStats label="Predictions" value={entry.predictionsCount} />
      </div>
    </li>
  );
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login?returnTo=/groups");
  }

  const { groupId } = await params;

  let accessToken: string;

  try {
    accessToken = (await auth0.getAccessToken()).token;
  } catch {
    redirect("/auth/login?returnTo=/groups");
  }

  const [currentUserProfile, rankingResult] = await Promise.all([
    getCurrentUserProfile(accessToken).catch(() => null),
    getGroupRanking(accessToken, groupId)
      .then((ranking) => ({ ranking, error: null as string | null }))
      .catch((error: unknown) => ({ ranking: [] as RankingEntry[], error: getRankingErrorMessage(error) })),
  ]);

  const currentUserRankingEntry = currentUserProfile
    ? rankingResult.ranking.find((entry) => entry.userId === currentUserProfile.id) ?? null
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="worldpredict-aurora absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-full border border-slate-800/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">WorldPredict</p>
            <p className="text-xs text-slate-400">Group ranking</p>
          </div>
          <Link
            href="/groups"
            className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
          >
            Back to groups
          </Link>
        </header>

        <section className="space-y-6 py-8 sm:py-10">
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              Private leaderboard
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Group {groupId}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Ranking details for your private group.
            </p>
          </div>

          {rankingResult.error ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {rankingResult.error}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ranking</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Current positions</h2>
              </div>
              <p className="text-sm text-slate-400">{rankingResult.ranking.length} players</p>
            </div>

            {currentUserRankingEntry ? (
              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
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
                    <p className="mt-1 text-lg font-bold text-white">{currentUserProfile?.username ?? "You"}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {rankingResult.ranking.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {rankingResult.ranking.map((entry) => (
                  <RankingRow
                    key={entry.userId}
                    entry={entry}
                    isCurrentUser={entry.userId === currentUserProfile?.id}
                  />
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                No ranking data yet. Once members score points, positions, exact predictions, and prediction counts
                will appear here.
              </div>
            )}

            <p className="mt-4 text-xs text-slate-500">
              Ranking data is backend-owned and read-only.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
