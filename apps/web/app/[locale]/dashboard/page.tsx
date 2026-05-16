import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

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
import { isProfileComplete } from "@/lib/profile";
import { cn } from "@/lib/cn";
import { findRankingEntryByUserId, getRankingPreview } from "@/lib/rankings";
import { getFriendlyDisplayName } from "@/lib/user-display";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import { RecentlyScoredResults, type RecentlyScoredResultItem, type RecentlyScoredResultsStrings } from "./recently-scored-results";
import { MatchPredictionAccordion, type DashboardStrings } from "./match-prediction-accordion";
import { CopyInviteCodeButton } from "../groups/copy-invite-code-button";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getLocalizedPath } from "@/lib/locale-nav";
import { buildPageMetadata } from "@/lib/metadata";
import type { AppLocale } from "@/lib/locale-nav";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("metadata.dashboard");
  return buildPageMetadata({
    description: t("description"),
    index: false,
    locale,
    path: "/dashboard",
    title: t("title"),
  });
}

type DashboardSearchParams = {
  error?: string;
};

interface DashboardPageProps {
  searchParams?: Promise<DashboardSearchParams>;
  params: Promise<{ locale: string }>;
}

interface MatchPredictionCard extends MatchView {
  prediction: PredictionView | null;
}

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

function getGroupRoleLabel(role: MyGroupView["role"], t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>): string {
  return role === "OWNER" ? t("groupSection.owner") : t("groupSection.member");
}

function formatMemberCount(memberCount: number, t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>): string {
  return t("groupSection.members", { count: memberCount });
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

function buildDashboardPath(locale: string, params: { error?: string } = {}): string {
  const searchParams = new URLSearchParams();

  if (params.error) {
    searchParams.set("error", params.error);
  }

  const queryString = searchParams.toString();

  return queryString ? getLocalizedPath(locale as AppLocale, `/dashboard?${queryString}`) : getLocalizedPath(locale as AppLocale, "/dashboard");
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

function formatPointsLabel(points: number, t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>): string {
  return points === 1 ? t("scoringExplanations.point", { count: points }) : t("scoringExplanations.points", { count: points });
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

function formatOutcomeLabel(outcome: MatchOutcome, t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>): string {
  switch (outcome) {
    case MATCH_OUTCOME.HOME_WIN:
      return t("scoringExplanations.homeWin");
    case MATCH_OUTCOME.AWAY_WIN:
      return t("scoringExplanations.awayWin");
    case MATCH_OUTCOME.DRAW:
      return t("scoringExplanations.draw");
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

function getScoringExplanation(match: MatchPredictionCard, t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>): ScoringExplanation | null {
  if (!match.prediction) {
    return null;
  }

  if (match.prediction.scoringStatus !== PREDICTION_SCORING_STATUS.SCORED) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: t("scoringExplanations.waitingForScoring"),
      detail: t("scoringExplanations.waitingForScoringDetail"),
    };
  }

  const actualScore = getActualScoreLine(match);

  if (!actualScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: t("scoringExplanations.finalScoreUnavailable"),
      detail: t("scoringExplanations.finalScoreUnavailableDetail"),
    };
  }

  const predictionScore = getPredictionScoreLine(match.prediction);
  const exactScore =
    predictionScore.homeScore === actualScore.homeScore && predictionScore.awayScore === actualScore.awayScore;

  if (exactScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.EXACT_SCORE,
      title: t("scoringExplanations.exactScore"),
      detail: t("scoringExplanations.exactScoreDetail", { points: match.prediction.pointsAwarded }),
    };
  }

  const predictedOutcome = resolveOutcome(predictionScore);
  const actualOutcome = resolveOutcome(actualScore);

  if (predictedOutcome === actualOutcome) {
    return {
      kind: SCORING_EXPLANATION_KIND.CORRECT_OUTCOME,
      title: t("scoringExplanations.correctOutcome"),
      detail: t("scoringExplanations.correctOutcomeDetail", {
        predictedOutcome: formatOutcomeLabel(predictedOutcome, t),
        actualOutcome: formatOutcomeLabel(actualOutcome, t),
      }),
    };
  }

  return {
    kind: SCORING_EXPLANATION_KIND.WRONG_OUTCOME,
    title: t("scoringExplanations.wrongOutcome"),
    detail: t("scoringExplanations.wrongOutcomeDetail", {
      predictedOutcome: formatOutcomeLabel(predictedOutcome, t),
      actualOutcome: formatOutcomeLabel(actualOutcome, t),
    }),
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

function getRecentlyScoredResultItems(matchCards: MatchPredictionCard[], t: Awaited<ReturnType<typeof getTranslations<"dashboard">>>): RecentlyScoredResultItem[] {
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
      const scoringExplanation = getScoringExplanation(match, t);

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
        explanationTitle: scoringExplanation?.title ?? t("scoringExplanations.waitingForScoring"),
        explanationDetail: scoringExplanation?.detail ?? t("scoringExplanations.waitingForScoringDetail"),
      };
    })
    .sort((left, right) => new Date(right.scoredAt).getTime() - new Date(left.scoredAt).getTime());
}

function getPredictionSaveErrorCode(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "updateFailed";
  }

  if (error.status === 401 || error.status === 403) {
    return "sessionExpired";
  }

  if (error.status === 404) {
    return "matchNotFound";
  }

  if (error.status === 400 && error.responseBody.toLowerCase().includes("no longer open")) {
    return "matchClosed";
  }

  if (error.status === 400) {
    return "invalidInput";
  }

  return "updateFailed";
}

export default async function DashboardPage({ searchParams, params }: DashboardPageProps) {
  const { locale } = await params;
  const t = await getTranslations("dashboard");

  const session = await auth0.getSession();

  if (!session) {
    redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/dashboard")}`);
  }

  // Resolve selected tournament from cookie (null → API uses ACTIVE fallback)
  const tournamentSlug = await resolveTournamentSlug();

  const resolvedSearchParams = await searchParams;

  let accessToken: string;

  try {
    accessToken = (await auth0.getAccessToken()).token;
  } catch {
    redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/dashboard")}`);
  }

  const [currentUserProfile, matches, predictions, globalRanking, myGroups] = await Promise.all([
    getCurrentUserProfile(accessToken).catch(() => null),
    getActiveTournamentMatches(tournamentSlug).catch(() => []),
    getMyPredictions(accessToken).catch(() => []),
    getGlobalRanking(tournamentSlug).catch(() => [] as RankingEntry[]),
    getMyGroups(accessToken, tournamentSlug).catch(() => [] as MyGroupView[]),
  ]);

  const profileComplete = currentUserProfile ? isProfileComplete(currentUserProfile) : false;
  const displayName = getFriendlyDisplayName(session.user, currentUserProfile);
  const matchCards = mergePredictions(matches, predictions);
  const upcomingMatchCards = getUpcomingMatchCards(matchCards);
  const recentlyScoredResultItems = getRecentlyScoredResultItems(matchCards, t);
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
      redirect(buildDashboardPath(locale, { error: "invalidInput" }));
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/dashboard")}`);
    }

    try {
      await upsertMatchPrediction(actionToken, matchId, {
        homeScore,
        awayScore,
      });
    } catch (error) {
      redirect(buildDashboardPath(locale, { error: getPredictionSaveErrorCode(error) }));
    }

    revalidatePath(getLocalizedPath(locale as AppLocale, "/dashboard"));
  }

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl">
      <section className="space-y-6 py-2 sm:py-4">
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              {t("eyebrow.worldCupPredictions")}
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {t("title.makeEveryWorldCup")}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {t("subtitle.expandOneMatch")}
            </p>
          </div>

          {resolvedSearchParams?.error ? (
            <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {t(`errorMessages.${resolvedSearchParams.error}`)}
            </div>
          ) : null}

          {featuredGroup ? (
            <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 shadow-xl shadow-cyan-950/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                    {myGroups.length > 1 ? t("groupSection.yourGroups") : t("groupSection.yourGroup")}
                  </p>
                  <div className="flex w-full grow flex-col">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-white">{featuredGroup.name}</h2>
                      <span className="rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1 text-xs text-cyan-100/80">
                        {getGroupRoleLabel(featuredGroup.role, t)}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-cyan-100/80">
                      <span className="rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1">
                        {formatMemberCount(featuredGroup.memberCount, t)}
                      </span>
                      {additionalGroupsCount > 0 ? (
                        <span className="rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1">
                          {t("groupSection.additionalGroups", { count: additionalGroupsCount })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <Link
                    href={getLocalizedPath(locale as AppLocale, `/groups/${featuredGroup.id}`)}
                    className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-4 py-2 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 sm:w-auto"
                  >
                    {t("groupSection.openFeaturedGroup")}
                  </Link>
                  {myGroups.length > 1 ? (
                    <Link href={getLocalizedPath(locale as AppLocale, "/groups")} className="text-center text-sm font-medium text-cyan-200 transition hover:text-white">
                      {t("groupSection.viewAllGroups")}
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center">
                <p className="px-2 text-sm leading-6 text-cyan-100/70">
                  {t("groupSection.shareCode")}
                </p>
                <CopyInviteCodeButton inviteCode={featuredGroup.inviteCode} showCode />
              </div>
            </section>
          ) : null}

          {!profileComplete ? (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100">
              <p className="text-sm font-semibold">{t("profileIncomplete.title")}</p>
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                {t("profileIncomplete.body")}
              </p>
              <Link
                href={getLocalizedPath(locale as AppLocale, "/onboarding")}
                className="mt-4 inline-flex rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                {t("profileIncomplete.finishProfile")}
              </Link>
            </div>
          ) : null}

          <RecentlyScoredResults
            items={recentlyScoredResultItems}
            i18n={{
              locale,
              recentlyScored: t("dashboardStrings.recentlyScored"),
              newResultsFromYourPredictions: t("dashboardStrings.newResultsFromYourPredictions"),
              theseAreFinishedMatches: t("dashboardStrings.theseAreFinishedMatches"),
              clear: t("dashboardStrings.clear"),
              final: t("dashboardStrings.final"),
              yourPick: t("dashboardStrings.yourPick"),
              points: t("dashboardStrings.points"),
              whyThisScore: t("dashboardStrings.whyThisScore"),
              stageUnavailable: t("dashboardStrings.stageUnavailable"),
              point: t("scoringExplanations.point", { count: 1 }),
              pointsLabel: t("scoringExplanations.points", { count: 999 }),
            }}
          />

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("predictionSection.worldCupPredictionsLabel")}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {t("predictionSection.compactRowsShow")}
                </p>
              </div>
            </div>

            <MatchPredictionAccordion
              matches={upcomingMatchCards}
              profileComplete={profileComplete}
              submitPredictionAction={submitPrediction}
              i18n={{
                locale,
                noUpcomingMatches: t("dashboardStrings.noUpcomingMatches"),
                loadingLocalDates: t("dashboardStrings.loadingLocalDates"),
                previousDate: t("dashboardStrings.previousDate"),
                nextDate: t("dashboardStrings.nextDate"),
                vs: t("dashboardStrings.vs"),
                exactScore: t("scoringExplanations.exactScore"),
                finalResult: t("dashboardStrings.finalResult"),
                yourPick: t("dashboardStrings.yourPick"),
                pointsEarned: t("dashboardStrings.pointsEarned"),
                scoredAt: t("dashboardStrings.scoredAt"),
                whyThisScore: t("dashboardStrings.whyThisScore"),
                noPredictionSubmitted: t("dashboardStrings.noPredictionSubmitted"),
                yourPrediction: t("dashboardStrings.yourPrediction"),
                setExactWorldCupScore: t("dashboardStrings.setExactWorldCupScore"),
                savePrediction: t("dashboardStrings.savePrediction"),
                matchFinalLocked: t("dashboardStrings.matchFinalLocked"),
                matchNoLongerOpen: t("dashboardStrings.matchNoLongerOpen"),
                completeProfileToUnlock: t("dashboardStrings.completeProfileToUnlock"),
                pending: t("dashboardStrings.pending"),
                resultPending: t("dashboardStrings.resultPending"),
                unknown: t("dashboardStrings.unknown"),
                waitingForFinalResult: t("dashboardStrings.waitingForFinalResult"),
                noPredictionSubmittedLabel: t("dashboardStrings.noPredictionSubmittedLabel"),
                predictionWaitingToBeScored: t("dashboardStrings.predictionWaitingToBeScored"),
                youEarned: t("dashboardStrings.youEarned", { points: "{points}" }),
                point: t("scoringExplanations.point", { count: 1 }),
                points: t("scoringExplanations.points", { count: 999 }),
                homeWin: t("scoringExplanations.homeWin"),
                awayWin: t("scoringExplanations.awayWin"),
                draw: t("scoringExplanations.draw"),
                waitingForScoring: t("scoringExplanations.waitingForScoring"),
                waitingForScoringDetail: t("scoringExplanations.waitingForScoringDetail"),
                finalScoreUnavailable: t("scoringExplanations.finalScoreUnavailable"),
                finalScoreUnavailableDetail: t("scoringExplanations.finalScoreUnavailableDetail"),
                correctOutcome: t("scoringExplanations.correctOutcome"),
                wrongOutcome: t("scoringExplanations.wrongOutcome"),
                exactScoreDetail: t("scoringExplanations.exactScoreDetail", { points: "{points}" }),
                correctOutcomeDetail: t("scoringExplanations.correctOutcomeDetail", { predictedOutcome: "{predictedOutcome}", actualOutcome: "{actualOutcome}" }),
                wrongOutcomeDetail: t("scoringExplanations.wrongOutcomeDetail", { predictedOutcome: "{predictedOutcome}", actualOutcome: "{actualOutcome}" }),
              }}
            />
          </div>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("rankingSection.globalRanking")}</p>
                <h2 className="mt-1 text-base font-semibold text-white">{t("rankingSection.yourOverallStanding")}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {t("rankingSection.seeHowYourPoints")}
                </p>
              </div>
              <Link
                href={getLocalizedPath(locale as AppLocale, "/rankings")}
                className="whitespace-nowrap rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
              >
                {t("rankingSection.viewAll")}
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
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{t("rankingSection.currentPosition")}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">{displayName}</p>
                      <p className="text-xs text-cyan-100/70">{t("rankingSection.yourPlaceInGlobalBoard")}</p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{t("rankingSection.points")}</p>
                    <p className="mt-1 text-3xl font-black tabular-nums text-white">{currentUserRankingEntry.totalPoints}</p>
                    <p className="text-xs font-semibold text-cyan-100/70">{t("rankingSection.pts")}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("rankingSection.exactPicks")}</p>
                    <p className="mt-1 text-xl font-black text-white">{currentUserRankingEntry.exactPredictions}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("rankingSection.predictions")}</p>
                    <p className="mt-1 text-xl font-black text-white">{currentUserRankingEntry.predictionsCount}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                {profileComplete
                  ? t("rankingSection.scoreFirstPrediction")
                  : t("rankingSection.completeProfileAndScore")}
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
                              {t("rankingSection.you")}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500">
                          {t("rankingSection.exactPicksLabel", { count: entry.exactPredictions, total: entry.predictionsCount })}
                        </p>
                      </div>
                      <p className="text-lg font-black text-cyan-300">{entry.totalPoints} pts</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                {t("rankingSection.noGlobalRankingYet")}
              </div>
            )}
          </section>
      </section>
    </main>
  );
}
