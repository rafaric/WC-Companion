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
import { buildPageMetadata } from "@/lib/metadata";
import { isProfileComplete } from "@/lib/profile";
import { cn } from "@/lib/cn";
import { findRankingEntryByUserId, getRankingPreview } from "@/lib/rankings";
import { getFriendlyDisplayName } from "@/lib/user-display";
import { RecentlyScoredResults, type RecentlyScoredResultItem } from "./recently-scored-results";
import { MatchPredictionAccordion } from "./match-prediction-accordion";
import { CopyInviteCodeButton } from "../groups/copy-invite-code-button";

export const metadata = buildPageMetadata({
  title: "Dashboard",
  description: "Review active World Cup fixtures, save predictions, and track your latest tournament results.",
  index: false,
  path: "/dashboard",
});

type DashboardSearchParams = {
  error?: string;
};

interface DashboardPageProps {
  searchParams?: Promise<DashboardSearchParams>;
}

interface MatchPredictionCard extends MatchView {
  prediction: PredictionView | null;
}

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

function getGroupRoleLabel(role: MyGroupView["role"]): string {
  return role === "OWNER" ? "Owner" : "Member";
}

function formatMemberCount(memberCount: number): string {
  return `${memberCount} ${memberCount === 1 ? "member" : "members"}`;
}

function selectFeaturedGroup(groups: MyGroupView[]): MyGroupView | null {
  return [...groups].sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === "OWNER" ? -1 : 1;
    }

    if (left.memberCount !== right.memberCount) {
      return right.memberCount - left.memberCount;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  })[0] ?? null;
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

function formatPointsLabel(points: number): string {
  return points === 1 ? "1 point" : `${points} points`;
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

function isMatchOpenForPrediction(match: MatchView): boolean {
  return match.status === MATCH_STATUS.UPCOMING && Date.now() < new Date(match.kickoffAt).getTime();
}

function isMatchFinished(match: MatchView): boolean {
  return match.status === MATCH_STATUS.FINISHED || match.finalizedAt !== null;
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
  const displayName = getFriendlyDisplayName(session.user, currentUserProfile);
  const matchCards = mergePredictions(matches, predictions);
  const upcomingMatchCards = getUpcomingMatchCards(matchCards);
  const recentlyScoredResultItems = getRecentlyScoredResultItems(matchCards);
  const currentUserRankingEntry = findRankingEntryByUserId(globalRanking, currentUserProfile?.id);
  const rankingPreview = getRankingPreview(globalRanking, 3);
  const featuredGroup = selectFeaturedGroup(myGroups);
  const additionalGroupsCount = featuredGroup ? Math.max(myGroups.length - 1, 0) : 0;

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
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl">
      <section className="space-y-6 py-2 sm:py-4">
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              World Cup predictions
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Make every World Cup fixture count.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Expand one match at a time, save exact scores, and keep your tournament picks easy to scan.
            </p>
          </div>

          {resolvedSearchParams?.error ? (
            <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {ERROR_MESSAGES[resolvedSearchParams.error] ?? "Something went wrong. Please try again."}
            </div>
          ) : null}

          {featuredGroup ? (
            <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 shadow-xl shadow-cyan-950/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                    {myGroups.length > 1 ? "Your groups" : "Your group"}
                  </p>
                  <div className="flex w-full grow flex-col">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-white">{featuredGroup.name}</h2>
                      <span className="rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1 text-xs text-cyan-100/80">
                        {getGroupRoleLabel(featuredGroup.role)}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-cyan-100/80">
                      <span className="rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1">
                        {formatMemberCount(featuredGroup.memberCount)}
                      </span>
                      {additionalGroupsCount > 0 ? (
                        <span className="rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1">
                          +{additionalGroupsCount} more group{additionalGroupsCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <Link
                    href={`/groups/${featuredGroup.id}`}
                    className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-4 py-2 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 sm:w-auto"
                  >
                    Open featured group
                  </Link>
                  {myGroups.length > 1 ? (
                    <Link href="/groups" className="text-center text-sm font-medium text-cyan-200 transition hover:text-white">
                      View all groups
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center">
                <p className="px-2 text-sm leading-6 text-cyan-100/70">
                  Share this code with friends so they can join this group:
                </p>
                <CopyInviteCodeButton inviteCode={featuredGroup.inviteCode} showCode />
              </div>
            </section>
          ) : null}

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
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">World Cup predictions</p>
                <p className="mt-1 text-sm text-slate-300">
                  Compact rows show each fixture and pick status. Open a match to update the full prediction.
                </p>
              </div>
            </div>

            <MatchPredictionAccordion
              matches={upcomingMatchCards}
              profileComplete={profileComplete}
              submitPredictionAction={submitPrediction}
            />
          </div>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Global ranking</p>
                <h2 className="mt-1 text-base font-semibold text-white">Your overall standing</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  See how your points compare across all players, beyond your private groups.
                </p>
              </div>
              <Link
                href="/rankings"
                className="whitespace-nowrap rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
              >
                View all
              </Link>
            </div>

            {currentUserRankingEntry ? (
              <div className="mt-4 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-slate-900/80 to-violet-400/10 p-4 shadow-xl shadow-cyan-950/20">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/30 bg-slate-950/70 shadow-lg shadow-cyan-500/10">
                      <span className="text-2xl font-black text-cyan-200">#{currentUserRankingEntry.position}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Current position</p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">{displayName}</p>
                      <p className="text-xs text-cyan-100/70">Your place in the global board</p>
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
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                {profileComplete
                  ? "Score your first matched prediction to appear in the ranking."
                  : "Complete your profile and score a match to join the ranking."}
              </div>
            )}

            {rankingPreview.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {rankingPreview.map((entry) => {
                  const isCurrentUser = entry.userId === currentUserProfile?.id;

                  return (
                    <li
                      key={entry.userId}
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition",
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
                })}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                No global ranking yet. Once scored predictions land, the board will appear here.
              </div>
            )}
          </section>
      </section>
    </main>
  );
}
