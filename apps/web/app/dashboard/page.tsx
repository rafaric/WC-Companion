import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import {
  getActiveTournamentMatches,
  getCurrentUserProfile,
  getGlobalRanking,
  getMyGroups,
  getMyPredictions,
  MATCH_STATUS,
  PREDICTION_SCORING_STATUS,
  upsertMatchPrediction,
  ApiError,
  type MatchView,
  type PredictionView,
  type MyGroupView,
  type RankingEntry,
} from "@/lib/api";
import { formatCountryLabel, getTeamLabel, isProfileComplete } from "@/lib/profile";
import { cn } from "@/lib/cn";
import { GLOBAL_RANKING_PREVIEW_LIMIT, findRankingEntryByUserId, getRankingPreview } from "@/lib/rankings";
import { RecentlyScoredResults, type RecentlyScoredResultItem } from "./recently-scored-results";
import { CopyInviteCodeButton } from "../groups/copy-invite-code-button";

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

const MATCH_OUTCOME = {
  AWAY_WIN: "away-win",
  DRAW: "draw",
  HOME_WIN: "home-win",
} as const;

type MatchOutcome = (typeof MATCH_OUTCOME)[keyof typeof MATCH_OUTCOME];

const SCORING_EXPLANATION_KIND = {
  CORRECT_OUTCOME: "correct-outcome",
  EXACT_SCORE: "exact-score",
  NOT_SCORED: "not-scored",
  WRONG_OUTCOME: "wrong-outcome",
} as const;

type ScoringExplanationKind = (typeof SCORING_EXPLANATION_KIND)[keyof typeof SCORING_EXPLANATION_KIND];

interface ScoreLine {
  homeScore: number;
  awayScore: number;
}

interface ScoringExplanation {
  kind: ScoringExplanationKind;
  title: string;
  detail: string;
}

function getDisplayName(user: Session["user"]): string {
  return user.name ?? user.nickname ?? user.email ?? user.sub;
}

function getGroupRoleLabel(role: MyGroupView["role"]): string {
  return role === "OWNER" ? "Owner" : "Member";
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

function buildDashboardPath(params: { error?: string } = {}): string {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  const queryString = searchParams.toString();

  return queryString ? `/dashboard?${queryString}` : "/dashboard";
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

function formatActualScoreLabel(match: MatchView): string {
  if (match.homeScore === null || match.awayScore === null) {
    return "Result pending";
  }

  return `${match.homeScore} - ${match.awayScore}`;
}

function formatPointsLabel(points: number): string {
  return points === 1 ? "1 point" : `${points} points`;
}

function formatScoredAt(value: string | null): string {
  if (!value) {
    return "Not scored yet";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function resolveOutcome(score: ScoreLine): MatchOutcome {
  if (score.homeScore > score.awayScore) {
    return MATCH_OUTCOME.HOME_WIN;
  }

  if (score.homeScore < score.awayScore) {
    return MATCH_OUTCOME.AWAY_WIN;
  }

  return MATCH_OUTCOME.DRAW;
}

function formatOutcomeLabel(outcome: MatchOutcome): string {
  switch (outcome) {
    case MATCH_OUTCOME.HOME_WIN:
      return "home win";
    case MATCH_OUTCOME.AWAY_WIN:
      return "away win";
    case MATCH_OUTCOME.DRAW:
      return "draw";
  }
}

function getActualScoreLine(match: MatchView): ScoreLine | null {
  if (match.homeScore === null || match.awayScore === null) {
    return null;
  }

  return {
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  };
}

function getPredictionScoreLine(prediction: PredictionView): ScoreLine {
  return {
    homeScore: prediction.homeScore,
    awayScore: prediction.awayScore,
  };
}

function getScoringExplanation(match: MatchPredictionCard): ScoringExplanation | null {
  if (!match.prediction) {
    return null;
  }

  if (match.prediction.scoringStatus !== PREDICTION_SCORING_STATUS.SCORED) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: "Waiting for scoring",
      detail: "Your prediction exists, but this match has not been scored yet.",
    };
  }

  const actualScore = getActualScoreLine(match);

  if (!actualScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: "Final score unavailable",
      detail: "We have the match marked as final, but the score is not available yet.",
    };
  }

  const predictionScore = getPredictionScoreLine(match.prediction);
  const exactScore =
    predictionScore.homeScore === actualScore.homeScore && predictionScore.awayScore === actualScore.awayScore;

  if (exactScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.EXACT_SCORE,
      title: "Exact score",
      detail: `You nailed the final score: ${formatPointsLabel(match.prediction.pointsAwarded)} awarded.`,
    };
  }

  const predictedOutcome = resolveOutcome(predictionScore);
  const actualOutcome = resolveOutcome(actualScore);

  if (predictedOutcome === actualOutcome) {
    return {
      kind: SCORING_EXPLANATION_KIND.CORRECT_OUTCOME,
      title: "Correct outcome",
      detail: `You predicted a ${formatOutcomeLabel(predictedOutcome)}, and the match ended as a ${formatOutcomeLabel(actualOutcome)}.`,
    };
  }

  return {
    kind: SCORING_EXPLANATION_KIND.WRONG_OUTCOME,
    title: "Wrong outcome",
    detail: `You predicted a ${formatOutcomeLabel(predictedOutcome)}, but the match ended as a ${formatOutcomeLabel(actualOutcome)}.`,
  };
}

function getScoringExplanationClassName(kind: ScoringExplanationKind): string {
  switch (kind) {
    case SCORING_EXPLANATION_KIND.EXACT_SCORE:
      return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
    case SCORING_EXPLANATION_KIND.CORRECT_OUTCOME:
      return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
    case SCORING_EXPLANATION_KIND.WRONG_OUTCOME:
      return "border-rose-300/30 bg-rose-300/10 text-rose-100";
    case SCORING_EXPLANATION_KIND.NOT_SCORED:
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
}

function isMatchOpenForPrediction(match: MatchView): boolean {
  return match.status === MATCH_STATUS.UPCOMING && Date.now() < new Date(match.kickoffAt).getTime();
}

function isMatchFinished(match: MatchView): boolean {
  return match.status === MATCH_STATUS.FINISHED || match.finalizedAt !== null;
}

function getPredictionOutcomeLabel(match: MatchPredictionCard): string {
  if (!isMatchFinished(match)) {
    return "Waiting for final result";
  }

  if (match.prediction === null) {
    return "No prediction submitted";
  }

  if (match.prediction.scoringStatus === PREDICTION_SCORING_STATUS.SCORED) {
    return `You earned ${formatPointsLabel(match.prediction.pointsAwarded)}`;
  }

  return "Prediction waiting to be scored";
}

function getUpcomingMatchCards(matchCards: MatchPredictionCard[]): MatchPredictionCard[] {
  return matchCards.filter((match) => isMatchOpenForPrediction(match));
}

function getRecentlyScoredResultItems(matchCards: MatchPredictionCard[]): RecentlyScoredResultItem[] {
  return matchCards
    .filter(
      (match) =>
        isMatchFinished(match) &&
        match.prediction !== null &&
        match.prediction.scoringStatus === PREDICTION_SCORING_STATUS.SCORED &&
        match.prediction.scoredAt !== null &&
        match.homeScore !== null &&
        match.awayScore !== null,
    )
    .map((match) => {
      const prediction = match.prediction;
      const scoringExplanation = getScoringExplanation(match);

      if (!prediction || !prediction.scoredAt || match.homeScore === null || match.awayScore === null) {
        throw new Error("Invalid recently scored match state");
      }

      return {
        id: prediction.id,
        matchId: match.id,
        homeTeamName: match.homeTeam.name,
        awayTeamName: match.awayTeam.name,
        stage: match.stage,
        groupName: match.groupName,
        finalHomeScore: match.homeScore,
        finalAwayScore: match.awayScore,
        predictedHomeScore: prediction.homeScore,
        predictedAwayScore: prediction.awayScore,
        pointsAwarded: prediction.pointsAwarded,
        scoredAt: prediction.scoredAt,
        explanationKind: scoringExplanation?.kind ?? SCORING_EXPLANATION_KIND.NOT_SCORED,
        explanationTitle: scoringExplanation?.title ?? "Waiting for scoring",
        explanationDetail: scoringExplanation?.detail ?? "Your prediction exists, but this match has not been scored yet.",
      };
    })
    .sort((left, right) => new Date(right.scoredAt).getTime() - new Date(left.scoredAt).getTime());
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

  const [currentUserProfile, matches, predictions, globalRanking, myGroups] = await Promise.all([
    getCurrentUserProfile(accessToken).catch(() => null),
    getActiveTournamentMatches().catch(() => []),
    getMyPredictions(accessToken).catch(() => []),
    globalRankingPromise,
    getMyGroups(accessToken).catch(() => [] as MyGroupView[]),
  ]);

  const profileComplete = currentUserProfile ? isProfileComplete(currentUserProfile) : false;
  const displayName = currentUserProfile?.username ?? getDisplayName(session.user);
  const matchCards = mergePredictions(matches, predictions);
  const upcomingMatchCards = getUpcomingMatchCards(matchCards);
  const recentlyScoredResultItems = getRecentlyScoredResultItems(matchCards);
  const currentUserRankingEntry = findRankingEntryByUserId(globalRanking, currentUserProfile?.id);
  const rankingPreview = getRankingPreview(globalRanking);
  const primaryGroup = myGroups[0] ?? null;

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
      redirect(buildDashboardPath({ error: "invalid_input" }));
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
      redirect(buildDashboardPath({ error: getPredictionSaveErrorCode(error) }));
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

          {primaryGroup ? (
            <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 shadow-xl shadow-cyan-950/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Your group</p>
                  <h2 className="text-lg font-semibold text-white">{primaryGroup.name}</h2>
                  <p className="text-sm leading-6 text-cyan-100/80">
                    You are a {getGroupRoleLabel(primaryGroup.role)} here.
                    {myGroups.length > 1 ? ` You are also in ${myGroups.length - 1} more group${myGroups.length - 1 === 1 ? "" : "s"}.` : ""}
                  </p>
                </div>

                <Link
                  href={`/groups/${primaryGroup.id}`}
                  className="inline-flex rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
                >
                  Open group ranking
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-cyan-100/80">
                <span className="rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1">
                  Invite {primaryGroup.inviteCode}
                </span>
                <span className="rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1">
                  {getGroupRoleLabel(primaryGroup.role)}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-cyan-100/70">Copy the invite code or jump into the private leaderboard.</p>
                <CopyInviteCodeButton inviteCode={primaryGroup.inviteCode} />
              </div>
            </section>
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

          <RecentlyScoredResults items={recentlyScoredResultItems} />

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Upcoming predictions</p>
                <p className="mt-1 text-sm text-slate-300">
                  Showing only matches still open for prediction, so you can focus on what needs action.
                </p>
              </div>
            </div>

            {upcomingMatchCards.length > 0 ? (
              upcomingMatchCards.map((match) => {
                const matchFinished = isMatchFinished(match);
                const scoringExplanation = getScoringExplanation(match);

                return (
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
                    <div className="flex flex-col items-end gap-2">
                      <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-300">
                        {formatPredictionLabel(match.prediction)}
                      </div>
                      {matchFinished ? (
                        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          Final {formatActualScoreLabel(match)}
                        </div>
                      ) : null}
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

                  {matchFinished ? (
                    <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Final result</p>
                          <p className="mt-1 text-2xl font-black text-white">{formatActualScoreLabel(match)}</p>
                          <p className="mt-1 text-sm text-emerald-100/80">{getPredictionOutcomeLabel(match)}</p>
                        </div>

                        {match.prediction ? (
                          <div className="grid gap-3 sm:min-w-72 sm:grid-cols-2">
                            <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-3">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Your pick</p>
                              <p className="mt-1 text-lg font-bold text-white">{formatPredictionLabel(match.prediction)}</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-3">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Points earned</p>
                              <p className="mt-1 text-lg font-bold text-white">{formatPointsLabel(match.prediction.pointsAwarded)}</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-3 sm:col-span-2">
                              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Scored at</p>
                              <p className="mt-1 text-sm font-semibold text-white">{formatScoredAt(match.prediction.scoredAt)}</p>
                            </div>
                            {scoringExplanation ? (
                              <div
                                className={`rounded-2xl border p-3 sm:col-span-2 ${getScoringExplanationClassName(scoringExplanation.kind)}`}
                              >
                                <p className="text-[11px] uppercase tracking-[0.2em] opacity-75">Why this score?</p>
                                <p className="mt-1 text-sm font-bold">{scoringExplanation.title}</p>
                                <p className="mt-1 text-xs leading-5 opacity-90">{scoringExplanation.detail}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300 sm:max-w-xs">
                            You did not submit a prediction for this match, so no points were awarded.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

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
                      {matchFinished
                        ? "This match is final, so predictions are locked."
                        : "This match is no longer open for predictions."}
                    </p>
                  ) : (
                    <p className="mt-5 text-sm leading-6 text-slate-400">
                      Complete your profile to unlock the prediction form for this match.
                    </p>
                  )}
                </article>
                );
              })
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
                No upcoming matches open for prediction right now. New scored matches will appear above when results land.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
