import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import {
  getActiveTournamentMatches,
  getCurrentUserProfile,
  getGlobalRanking,
  getMyPredictions,
  upsertMatchPrediction,
  ApiError,
  type MatchView,
  type PredictionView,
  type RankingEntry,
} from "@/lib/api";
import { formatCountryLabel, getTeamLabel, isProfileComplete } from "@/lib/profile";
import { cn } from "@/lib/cn";
import { GLOBAL_RANKING_PREVIEW_LIMIT, findRankingEntryByUserId, getRankingPreview } from "@/lib/rankings";

type DashboardSearchParams = {
  error?: string;
};

interface DashboardPageProps {
  searchParams?: Promise<DashboardSearchParams>;
}

interface MatchPredictionCard extends MatchView {
  prediction: PredictionView | null;
}

type Session = NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>;

const MATCHES_FINALIZE_PERMISSION = "matches:finalize" as const;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Enter whole numbers between 0 and 20 for both scores.",
  match_closed: "This match is no longer open for predictions.",
  match_not_found: "We could not find that match. Refresh and try again.",
  session_expired: "Your session expired. Sign in again to save predictions.",
  update_failed: "We could not save your prediction right now. Try again.",
};

function getDisplayName(user: Session["user"]): string {
  return user.name ?? user.nickname ?? user.email ?? user.sub;
}

function getUserPermissions(user: Session["user"]): string[] {
  const permissions = (user as { permissions?: unknown }).permissions;

  if (!Array.isArray(permissions) || permissions.some((permission) => typeof permission !== "string")) {
    return [];
  }

  return permissions;
}

function canAccessExternalResults(user: Session["user"]): boolean {
  return getUserPermissions(user).includes(MATCHES_FINALIZE_PERMISSION);
}

function formatKickoff(kickoffAt: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(kickoffAt));
}

function formatStatusLabel(status: string): string {
  if (!status) {
    return "Unknown";
  }

  const normalized = status.split("_").join(" ").toLowerCase();

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function parseScoreValue(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function mergePredictions(matches: MatchView[], predictions: PredictionView[]): MatchPredictionCard[] {
  const predictionsByMatchId = new Map(predictions.map((prediction) => [prediction.matchId, prediction] as const));

  return matches.map((match) => ({
    ...match,
    prediction: predictionsByMatchId.get(match.id) ?? null,
  }));
}

function formatPredictionLabel(prediction: PredictionView | null): string {
  if (!prediction) {
    return "No prediction yet";
  }

  return `${prediction.homeScore} - ${prediction.awayScore}`;
}

function isMatchOpenForPrediction(match: MatchView): boolean {
  return match.status === "UPCOMING" && Date.now() < new Date(match.kickoffAt).getTime();
}

function getPredictionSaveErrorCode(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "update_failed";
  }

  if (error.status === 401 || error.status === 403) {
    return "session_expired";
  }

  if (error.status === 404) {
    return "match_not_found";
  }

  if (error.status === 400 && error.responseBody.toLowerCase().includes("no longer open")) {
    return "match_closed";
  }

  if (error.status === 400) {
    return "invalid_input";
  }

  return "update_failed";
}

function findTeamById(matches: MatchView[], teamId: string | null): MatchView["homeTeam"] | null {
  if (!teamId) {
    return null;
  }

  for (const match of matches) {
    if (match.homeTeam.id === teamId) {
      return match.homeTeam;
    }

    if (match.awayTeam.id === teamId) {
      return match.awayTeam;
    }
  }

  return null;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login?returnTo=/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const globalRankingPromise = getGlobalRanking().catch(() => [] as RankingEntry[]);

  let accessToken: string;

  try {
    accessToken = (await auth0.getAccessToken()).token;
  } catch {
    redirect("/auth/login?returnTo=/dashboard");
  }

  const [currentUserProfile, matches, predictions, globalRanking] = await Promise.all([
    getCurrentUserProfile(accessToken).catch(() => null),
    getActiveTournamentMatches().catch(() => []),
    getMyPredictions(accessToken).catch(() => []),
    globalRankingPromise,
  ]);

  const profileComplete = currentUserProfile ? isProfileComplete(currentUserProfile) : false;
  const displayName = currentUserProfile?.username ?? getDisplayName(session.user);
  const matchCards = mergePredictions(matches, predictions);
  const currentUserRankingEntry = findRankingEntryByUserId(globalRanking, currentUserProfile?.id);
  const rankingPreview = getRankingPreview(globalRanking);

  async function submitPrediction(matchId: string, formData: FormData) {
    "use server";

    const homeScore = parseScoreValue(String(formData.get("homeScore") ?? ""));
    const awayScore = parseScoreValue(String(formData.get("awayScore") ?? ""));

    if (
      homeScore === null ||
      awayScore === null ||
      homeScore < 0 ||
      homeScore > 20 ||
      awayScore < 0 ||
      awayScore > 20
    ) {
      redirect("/dashboard?error=invalid_input");
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/dashboard");
    }

    try {
      await upsertMatchPrediction(actionToken, matchId, {
        homeScore,
        awayScore,
      });
    } catch (error) {
      redirect(`/dashboard?error=${getPredictionSaveErrorCode(error)}`);
    }

    revalidatePath("/dashboard");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="worldpredict-aurora absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-full border border-slate-800/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">WorldPredict</p>
            <p className="text-xs text-slate-400">Predictions dashboard</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="hidden sm:inline">{displayName}</span>
            <Link
              href="/groups"
              className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
            >
              Groups
            </Link>
            <Link
              href="/share"
              className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
            >
              Share cards
            </Link>
            {canAccessExternalResults(session.user) ? (
              <Link
                href="/admin/external-results"
                className="rounded-full border border-amber-500/40 bg-amber-400/10 px-4 py-2 font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-400/20"
              >
                External results
              </Link>
            ) : null}
            <Link
              href="/auth/logout"
              className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
            >
              Log out
            </Link>
          </div>
        </header>

        <section className="space-y-6 py-8 sm:py-10">
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              Your match predictions
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Keep your pronósticos in one place.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Review active fixtures, save exact scores, and track your current estimations without leaving the dashboard.
            </p>
          </div>

          {resolvedSearchParams?.error ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {ERROR_MESSAGES[resolvedSearchParams.error] ?? "Something went wrong. Please try again."}
            </div>
          ) : null}

          {currentUserProfile ? (
            <div className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Profile</p>
                <p className="mt-1 font-semibold text-white">{displayName}</p>
                <p className="text-sm text-slate-400">{currentUserProfile.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Country</p>
                <p className="mt-1 font-semibold text-white">{formatCountryLabel(currentUserProfile.country)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Favorite team</p>
                <p className="mt-1 font-semibold text-white">
                  {getTeamLabel(findTeamById(matches, currentUserProfile.favoriteTeamId))}
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Global ranking</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Your standing</h2>
                </div>
                <Link
                  href="/rankings"
                  className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  View all
                </Link>
              </div>

              {currentUserRankingEntry ? (
                <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Current position</p>
                      <p className="mt-1 text-2xl font-black text-white">#{currentUserRankingEntry.position}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Points</p>
                      <p className="mt-1 text-2xl font-black text-white">{currentUserRankingEntry.totalPoints}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Exact</p>
                      <p className="mt-1 text-lg font-bold text-white">{currentUserRankingEntry.exactPredictions}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Predictions</p>
                      <p className="mt-1 text-lg font-bold text-white">{currentUserRankingEntry.predictionsCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Username</p>
                      <p className="mt-1 text-lg font-bold text-white">{displayName}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                  {profileComplete
                    ? "Score your first matched prediction to appear in the ranking."
                    : "Complete your profile and score a match to join the ranking."}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Top ranking</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Preview</h2>
                </div>
                <p className="text-sm text-slate-400">Top {GLOBAL_RANKING_PREVIEW_LIMIT}</p>
              </div>

              {rankingPreview.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {rankingPreview.map((entry) => {
                    const isCurrentUser = entry.userId === currentUserProfile?.id;

                    return (
                      <li
                        key={entry.userId}
                        className={cn(
                          "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition",
                          isCurrentUser
                            ? "border-cyan-400/40 bg-cyan-400/10"
                            : "border-slate-800 bg-slate-950/60",
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
                  })}
                </ul>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                  No global ranking yet. Once scored predictions land, the board will appear here.
                </div>
              )}
            </section>
          </div>

          {!profileComplete ? (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100">
              <p className="text-sm font-semibold">Complete your profile to submit predictions.</p>
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                Country and favorite team are required before we unlock the form.
              </p>
              <Link
                href="/onboarding"
                className="mt-4 inline-flex rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Finish profile
              </Link>
            </div>
          ) : null}

          <div className="space-y-4">
            {matchCards.length > 0 ? (
              matchCards.map((match) => (
                <article key={match.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {formatStatusLabel(match.status)}
                      </p>
                      <h2 className="text-lg font-semibold text-white">
                        {getTeamLabel(match.homeTeam)} vs {getTeamLabel(match.awayTeam)}
                      </h2>
                      <p className="text-sm text-slate-400">
                        {match.stage}
                        {match.groupName ? ` · ${match.groupName}` : ""} · {formatKickoff(match.kickoffAt)}
                      </p>
                    </div>
                    <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-300">
                      {formatPredictionLabel(match.prediction)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Home</p>
                      <p className="mt-1 font-semibold text-white">{match.homeTeam.name}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Away</p>
                      <p className="mt-1 font-semibold text-white">{match.awayTeam.name}</p>
                    </div>
                  </div>

                  {profileComplete && isMatchOpenForPrediction(match) ? (
                    <form action={submitPrediction.bind(null, match.id)} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Home goals</span>
                        <input
                          name="homeScore"
                          type="number"
                          min={0}
                          max={20}
                          step={1}
                          defaultValue={match.prediction?.homeScore ?? ""}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                          required
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-200">Away goals</span>
                        <input
                          name="awayScore"
                          type="number"
                          min={0}
                          max={20}
                          step={1}
                          defaultValue={match.prediction?.awayScore ?? ""}
                          className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                          required
                        />
                      </label>

                      <button
                        type="submit"
                        className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
                      >
                        Save
                      </button>
                    </form>
                  ) : profileComplete ? (
                    <p className="mt-5 text-sm leading-6 text-slate-400">
                      This match is no longer open for predictions.
                    </p>
                  ) : (
                    <p className="mt-5 text-sm leading-6 text-slate-400">
                      Complete your profile to unlock the prediction form for this match.
                    </p>
                  )}
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
                No active fixtures yet. When the tournament publishes matches, they will appear here.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
