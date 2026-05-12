import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth0 } from "@/lib/auth0";
import {
  ApiError,
  createGroupRankingShareCard,
  createMyPerformanceSummaryShareCard,
  createPredictionShareCard,
  getActiveTournamentMatches,
  getCurrentUserProfile,
  getGlobalRanking,
  getGroupRanking,
  getMyGroups,
  getMyPredictions,
  type MatchView,
  type MyGroupView,
  type PredictionView,
  type RankingEntry,
} from "@/lib/api";
import { formatCountryLabel, getTeamLabel } from "@/lib/profile";
import { findRankingEntryByUserId, getRankingPreview } from "@/lib/rankings";
import { getFriendlyDisplayName } from "@/lib/user-display";

import { ShareActions } from "./share-actions";

type ShareSearchParams = {
  error?: string;
  groupId?: string;
  matchId?: string;
  success?: string;
};

interface SharePageProps {
  searchParams?: Promise<ShareSearchParams>;
}

const SHARE_SUCCESS = {
  PREDICTION: "prediction",
  PERFORMANCE_SUMMARY: "performance_summary",
  GROUP_RANKING: "group_ranking",
} as const;

const SHARE_ERROR = {
  INVALID_INPUT: "invalid_input",
  SESSION_EXPIRED: "session_expired",
  PREDICTION_NOT_FOUND: "prediction_not_found",
  PERFORMANCE_NOT_READY: "performance_not_ready",
  GROUP_FORBIDDEN: "group_forbidden",
  GROUP_NOT_READY: "group_not_ready",
  CREATE_FAILED: "create_failed",
} as const;

type ShareSuccess = (typeof SHARE_SUCCESS)[keyof typeof SHARE_SUCCESS];
type ShareError = (typeof SHARE_ERROR)[keyof typeof SHARE_ERROR];

const SUCCESS_MESSAGES: Record<ShareSuccess, string> = {
  prediction: "Prediction preview ready.",
  performance_summary: "Performance summary ready.",
  group_ranking: "Group standing ready.",
};

const ERROR_MESSAGES: Record<ShareError, string> = {
  invalid_input: "Choose a valid prediction or group before generating a share card.",
  session_expired: "Your session expired. Sign in again to generate share cards.",
  prediction_not_found: "We could not find that saved prediction.",
  performance_not_ready: "Your performance summary is not ready yet.",
  group_forbidden: "You need access to that group before sharing its standing.",
  group_not_ready: "We could not find a ranking snapshot for that group yet.",
  create_failed: "We could not generate the share card right now. Try again.",
};

interface PreviewStat {
  label: string;
  value: string;
}

interface PreviewCardProps {
  eyebrow: string;
  title: string;
  description: string;
  stats: PreviewStat[];
  note: string;
  shareActions?: ReactNode;
  backgroundImage?: string;
}

interface ShareContent {
  title: string;
  text: string;
  url: string;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function formatMatchLabel(match: MatchView): string {
  return `${getTeamLabel(match.homeTeam)} vs ${getTeamLabel(match.awayTeam)}`;
}

function formatPredictionLabel(prediction: PredictionView): string {
  return `${prediction.homeScore} - ${prediction.awayScore}`;
}

async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");

  if (!host) {
    return "http://localhost:3000";
  }

  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProto ?? (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

function buildShareUrl(origin: string, query: Record<string, string | null | undefined>): string {
  const url = new URL("/share", origin);

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function buildPredictionShareContent(
  origin: string,
  username: string,
  selectedPrediction: { prediction: PredictionView; match: MatchView | null },
): ShareContent {
  const { prediction, match } = selectedPrediction;
  const title = "WorldPredict prediction preview";
  const text = [
    title,
    `${username} picked ${match ? formatMatchLabel(match) : prediction.matchId}`,
    `Predicted score: ${formatPredictionLabel(prediction)}`,
    `Points: ${prediction.pointsAwarded}`,
  ].join("\n");

  return {
    title,
    text,
    url: buildShareUrl(origin, { success: SHARE_SUCCESS.PREDICTION, matchId: prediction.matchId }),
  };
}

function buildPerformanceSummaryShareContent(origin: string, username: string, rankingEntry: RankingEntry): ShareContent {
  const title = "WorldPredict performance summary";
  const text = [
    title,
    `${username} is #${rankingEntry.position} with ${rankingEntry.totalPoints} points`,
    `Exact predictions: ${rankingEntry.exactPredictions}`,
    `Saved predictions: ${rankingEntry.predictionsCount}`,
  ].join("\n");

  return {
    title,
    text,
    url: buildShareUrl(origin, { success: SHARE_SUCCESS.PERFORMANCE_SUMMARY }),
  };
}

function buildGroupRankingShareContent(
  origin: string,
  username: string,
  groupName: string,
  rankingEntry: RankingEntry,
  groupId: string,
): ShareContent {
  const title = "WorldPredict group ranking";
  const text = [
    title,
    groupName,
    `${username} is #${rankingEntry.position} with ${rankingEntry.totalPoints} points`,
  ].join("\n");

  return {
    title,
    text,
    url: buildShareUrl(origin, { success: SHARE_SUCCESS.GROUP_RANKING, groupId }),
  };
}

function getShareErrorCode(error: unknown, kind: "prediction" | "performance" | "group"): ShareError {
  if (!(error instanceof ApiError)) {
    return SHARE_ERROR.CREATE_FAILED;
  }

  if (error.status === 401) {
    return SHARE_ERROR.SESSION_EXPIRED;
  }

  if (error.status === 403 && kind !== "group") {
    return SHARE_ERROR.SESSION_EXPIRED;
  }

  if (kind === "prediction") {
    if (error.status === 404) {
      return SHARE_ERROR.PREDICTION_NOT_FOUND;
    }
    return error.status === 400 ? SHARE_ERROR.INVALID_INPUT : SHARE_ERROR.CREATE_FAILED;
  }

  if (kind === "performance") {
    if (error.status === 404) {
      return SHARE_ERROR.PERFORMANCE_NOT_READY;
    }
    return error.status === 400 ? SHARE_ERROR.INVALID_INPUT : SHARE_ERROR.CREATE_FAILED;
  }

  if (error.status === 403) {
    return SHARE_ERROR.GROUP_FORBIDDEN;
  }

  if (error.status === 404) {
    return SHARE_ERROR.GROUP_NOT_READY;
  }

  return error.status === 400 ? SHARE_ERROR.INVALID_INPUT : SHARE_ERROR.CREATE_FAILED;
}

function PreviewCard({ eyebrow, title, description, stats, note, shareActions, backgroundImage }: PreviewCardProps) {
  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-slate-950/30"
      style={backgroundImage ? {
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.85)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
            <p className="mt-1 text-base font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">{note}</p>
      {shareActions ? <div className="mt-4">{shareActions}</div> : null}
    </article>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className="space-y-3 rounded-3xl border border-slate-800/50 p-6"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85)), url(/assets/hero.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
      <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{description}</p>
    </div>
  );
}

function mergePredictions(matches: MatchView[], predictions: PredictionView[]): Array<{
  prediction: PredictionView;
  match: MatchView | null;
}> {
  const matchesById = new Map(matches.map((match) => [match.id, match] as const));

  return predictions.map((prediction) => ({
    prediction,
    match: matchesById.get(prediction.matchId) ?? null,
  }));
}

function findGroupById(groups: MyGroupView[], groupId: string | null | undefined): MyGroupView | null {
  if (!groupId) {
    return null;
  }

  return groups.find((group) => group.id === groupId) ?? null;
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login?returnTo=/share");
  }

  const resolvedSearchParams = await searchParams;

  let accessToken: string;

  try {
    accessToken = (await auth0.getAccessToken()).token;
  } catch {
    redirect("/auth/login?returnTo=/share");
  }

  const [currentUserProfile, matches, predictions, myGroups, globalRanking] = await Promise.all([
    getCurrentUserProfile(accessToken).catch(() => null),
    getActiveTournamentMatches().catch(() => [] as MatchView[]),
    getMyPredictions(accessToken).catch(() => [] as PredictionView[]),
    getMyGroups(accessToken).catch(() => [] as MyGroupView[]),
    getGlobalRanking().catch(() => [] as RankingEntry[]),
  ]);

  const displayName = getFriendlyDisplayName(session.user, currentUserProfile);
  const currentUserRankingEntry = findRankingEntryByUserId(globalRanking, currentUserProfile?.id);
  const rankingPreview = getRankingPreview(globalRanking);
  const predictionOptions = mergePredictions(matches, predictions);
  const selectedPrediction = resolvedSearchParams?.matchId
    ? predictionOptions.find((option) => option.prediction.matchId === resolvedSearchParams.matchId) ?? null
    : null;
  const selectedGroupId = resolvedSearchParams?.groupId ?? null;
  const selectedGroup = findGroupById(myGroups, selectedGroupId);
  const selectedGroupRanking =
    selectedGroupId && resolvedSearchParams?.success === SHARE_SUCCESS.GROUP_RANKING
      ? await getGroupRanking(accessToken, selectedGroupId).catch(() => [] as RankingEntry[])
      : [];
  const shareOrigin = await getRequestOrigin();
  const shareUsername = displayName;

  const predictionShareContent = selectedPrediction
    ? buildPredictionShareContent(shareOrigin, shareUsername, selectedPrediction)
    : null;
  const performanceSummaryShareContent = currentUserRankingEntry
    ? buildPerformanceSummaryShareContent(shareOrigin, shareUsername, currentUserRankingEntry)
    : null;
  const groupRankingShareContent = selectedGroup && selectedGroupRanking[0]
    ? buildGroupRankingShareContent(shareOrigin, shareUsername, selectedGroup.name, selectedGroupRanking[0], selectedGroup.id)
    : null;

  async function submitPredictionPreview(formData: FormData) {
    "use server";

    const matchId = String(formData.get("matchId") ?? "").trim();

    if (!matchId) {
      redirect("/share?error=invalid_input");
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/share");
    }

    try {
      await createPredictionShareCard(actionToken, matchId);
    } catch (error) {
      redirect(`/share?error=${getShareErrorCode(error, "prediction")}`);
    }

    redirect(`/share?success=${SHARE_SUCCESS.PREDICTION}&matchId=${matchId}`);
  }

  async function submitPerformanceSummaryPreview(_formData: FormData) {
    "use server";

    void _formData;

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/share");
    }

    try {
      await createMyPerformanceSummaryShareCard(actionToken);
    } catch (error) {
      redirect(`/share?error=${getShareErrorCode(error, "performance")}`);
    }

    redirect(`/share?success=${SHARE_SUCCESS.PERFORMANCE_SUMMARY}`);
  }

  async function submitGroupRankingPreview(formData: FormData) {
    "use server";

    const groupId = String(formData.get("groupId") ?? "").trim();

    if (!groupId) {
      redirect("/share?error=invalid_input");
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/share");
    }

    try {
      await createGroupRankingShareCard(actionToken, groupId);
    } catch (error) {
      redirect(`/share?error=${getShareErrorCode(error, "group")}&groupId=${groupId}`);
    }

    redirect(`/share?success=${SHARE_SUCCESS.GROUP_RANKING}&groupId=${groupId}`);
  }

  const performanceSummaryStats = currentUserRankingEntry
    ? [
        { label: "Position", value: `#${currentUserRankingEntry.position}` },
        { label: "Points", value: `${currentUserRankingEntry.totalPoints}` },
        { label: "Exact", value: `${currentUserRankingEntry.exactPredictions}` },
        { label: "Predictions", value: `${currentUserRankingEntry.predictionsCount}` },
      ]
    : [{ label: "Status", value: "No ranking entry yet" }];

  const groupRankingStats = selectedGroupRanking[0]
    ? [
        { label: "Group", value: selectedGroup?.name ?? selectedGroupId ?? "Selected group" },
        { label: "Position", value: `#${selectedGroupRanking[0].position}` },
        { label: "Points", value: `${selectedGroupRanking[0].totalPoints}` },
        { label: "Predictions", value: `${selectedGroupRanking[0].predictionsCount}` },
      ]
    : [{ label: "Status", value: selectedGroup ? "Ranking not ready yet" : "Choose a group" }];

  const predictionStats = selectedPrediction
    ? [
        { label: "Match", value: selectedPrediction.match ? formatMatchLabel(selectedPrediction.match) : selectedPrediction.prediction.matchId },
        { label: "Your score", value: formatPredictionLabel(selectedPrediction.prediction) },
        { label: "Points", value: `${selectedPrediction.prediction.pointsAwarded}` },
        { label: "Status", value: selectedPrediction.prediction.scoringStatus },
      ]
    : [{ label: "Status", value: predictionOptions.length > 0 ? "Pick a saved prediction" : "No saved predictions yet" }];

  return (
    <main className="mx-auto w-full max-w-5xl">
      <section className="space-y-8 py-2 sm:py-4">
          <SectionHeader
            eyebrow="Shareable snapshots"
            title="Preview the card before you share it."
            description="Create payload snapshots for your prediction, group standing, or performance summary. Image rendering is not wired yet, so this page focuses on the data that will be shared."
          />

          {resolvedSearchParams?.success ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {SUCCESS_MESSAGES[resolvedSearchParams.success as ShareSuccess] ?? "Ready."}
            </div>
          ) : null}

          {resolvedSearchParams?.error ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {ERROR_MESSAGES[resolvedSearchParams.error as ShareError] ?? "Something went wrong. Please try again."}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <form action={submitPredictionPreview} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Prediction</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Share your prediction</h2>
                </div>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                  Backend snapshot
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Pick one of your saved predictions and create a backend-owned payload snapshot.
              </p>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-slate-200">Saved prediction</span>
                <select
                  name="matchId"
                  defaultValue={selectedPrediction?.prediction.matchId ?? ""}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                  required
                  disabled={predictionOptions.length === 0}
                >
                  <option value="" disabled>
                    {predictionOptions.length === 0 ? "No predictions available" : "Choose a prediction"}
                  </option>
                  {predictionOptions.map(({ prediction, match }) => (
                    <option key={prediction.id} value={prediction.matchId}>
                      {match ? `${formatMatchLabel(match)} · ${formatPredictionLabel(prediction)}` : prediction.matchId}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-slate-500">Uses your saved prediction data. No image file is generated yet.</p>
                <button
                  type="submit"
                  className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={predictionOptions.length === 0}
                >
                  Preview prediction
                </button>
              </div>
            </form>

            <PreviewCard
              eyebrow="Preview payload"
              title={selectedPrediction ? "Prediction snapshot" : "No prediction selected"}
              description={
                selectedPrediction
                  ? `${selectedPrediction.match ? formatMatchLabel(selectedPrediction.match) : "Saved prediction"} · ${formatDate(selectedPrediction.prediction.updatedAt)}`
                  : "Choose a saved prediction to see the payload that would be shared."
              }
              stats={predictionStats}
              note="Current MVP cards store structured data only. That keeps the UX fast and lets image rendering land later without changing the flow."
              backgroundImage="/assets/shareprediction.png"
              shareActions={
                predictionShareContent ? (
                  <ShareActions title={predictionShareContent.title} text={predictionShareContent.text} url={predictionShareContent.url} />
                ) : (
                  <p className="text-xs leading-5 text-slate-500">Pick a saved prediction to enable copy/share.</p>
                )
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <form action={submitPerformanceSummaryPreview} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Performance summary</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Share your performance summary</h2>
                </div>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                  Backend snapshot
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Capture your current tournament standing as a backend-owned payload snapshot.
              </p>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-slate-500">
                  This uses the existing share-card endpoint. If your ranking is not ready yet, you will get a specific message.
                </p>
                <button
                  type="submit"
                  className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
                >
                  Generate summary
                </button>
              </div>
            </form>

            <PreviewCard
              eyebrow="Performance preview"
              title={currentUserRankingEntry ? `#${currentUserRankingEntry.position} · ${displayName}` : "No performance snapshot yet"}
              description={
                currentUserRankingEntry
                  ? `Tournament standing for ${currentUserProfile ? formatCountryLabel(currentUserProfile.country) : "your profile"}.`
                  : "Your ranking entry will appear here once backend scoring is available."
              }
              stats={performanceSummaryStats}
              note={`Top of leaderboard preview: ${rankingPreview.length > 0 ? rankingPreview.length : 0} ranked players loaded.`}
              backgroundImage="/assets/squadPerformance.png"
              shareActions={
                performanceSummaryShareContent ? (
                  <ShareActions
                    title={performanceSummaryShareContent.title}
                    text={performanceSummaryShareContent.text}
                    url={performanceSummaryShareContent.url}
                  />
                ) : null
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <form action={submitGroupRankingPreview} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Group standing</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Share group standing</h2>
                </div>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                  Private
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                Choose one of your groups and create a backend snapshot of the current ranking.
              </p>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-slate-200">My groups</span>
                <select
                  name="groupId"
                  defaultValue={selectedGroup?.id ?? ""}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                  required
                  disabled={myGroups.length === 0}
                >
                  <option value="" disabled>
                    {myGroups.length === 0 ? "No groups available" : "Choose a group"}
                  </option>
                  {myGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs leading-5 text-slate-500">Members only. The backend validates access before creating the snapshot.</p>
                <button
                  type="submit"
                  className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={myGroups.length === 0}
                >
                  Generate group card
                </button>
              </div>
            </form>

            <PreviewCard
              eyebrow="Group preview"
              title={selectedGroup?.name ?? selectedGroupId ?? "No group selected"}
              description={
                selectedGroup
                  ? `Current ranking preview for ${selectedGroup.name}.`
                  : selectedGroupId
                    ? `Current ranking preview for ${selectedGroupId}.`
                    : "Pick a group to preview the standing card payload."
              }
              stats={groupRankingStats}
              backgroundImage="/assets/groupLeaderb.png"
              note={
                selectedGroup
                  ? `Created at ${formatDate(selectedGroup.createdAt)} · invite code stays private.`
                  : "The card preview will surface the group's current position, points, and prediction counts."
              }
              shareActions={
                groupRankingShareContent ? (
                  <ShareActions title={groupRankingShareContent.title} text={groupRankingShareContent.text} url={groupRankingShareContent.url} />
                ) : selectedGroup ? (
                  <p className="text-xs leading-5 text-slate-500">Generate the group card to enable copy/share.</p>
                ) : null
              }
            />
          </div>
      </section>
    </main>
  );
}
