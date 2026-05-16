import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { Metadata } from "next";

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
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import { FlagIcon } from "@/components/FlagIcon";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getLocalizedPath, type AppLocale } from "@/lib/locale-nav";
import { buildPageMetadata } from "@/lib/metadata";

import { ShareActions } from "./share-actions";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("metadata.share");
  return buildPageMetadata({
    description: t("description"),
    index: false,
    locale,
    path: "/share",
    title: t("title"),
  });
}

type ShareSearchParams = {
  error?: string;
  groupId?: string;
  matchId?: string;
  success?: string;
};

interface SharePageProps {
  searchParams?: Promise<ShareSearchParams>;
  params: Promise<{ locale: string }>;
}

const SHARE_SUCCESS = {
  PREDICTION: "prediction",
  PERFORMANCE_SUMMARY: "performance_summary",
  GROUP_RANKING: "group_ranking",
} as const;

type ShareSuccess = (typeof SHARE_SUCCESS)[keyof typeof SHARE_SUCCESS];

interface PredictionShareTemplateProps {
  predictionOption: { prediction: PredictionView; match: MatchView | null } | null;
  predictedBy: string;
  captureTargetId?: string;
  shareActions?: ReactNode;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"share">>>;
}

interface PerformanceSummaryShareTemplateProps {
  rankingEntry: RankingEntry | null;
  displayName: string;
  countryLabel?: string | null;
  leaderboardCount: number;
  captureTargetId?: string;
  shareActions?: ReactNode;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"share">>>;
}

interface GroupShareTemplateProps {
  group: MyGroupView | null;
  rankingEntry: RankingEntry | null;
  previewId?: string;
  captureTargetId?: string;
  shareActions?: ReactNode;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<"share">>>;
}

interface ShareContent {
  title: string;
  text: string;
  url: string;
}

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
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

function buildShareUrl(origin: string, locale: string, query: Record<string, string | null | undefined>): string {
  const url = new URL(`/${locale}/share`, origin);

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function buildPredictionShareContent(
  origin: string,
  locale: string,
  username: string,
  selectedPrediction: { prediction: PredictionView; match: MatchView | null },
  t: Awaited<ReturnType<typeof getTranslations<"share">>>,
): ShareContent {
  const { prediction, match } = selectedPrediction;
  const title = t("templates.shareMyPrediction");
  const text = [
    title,
    `${username} picked ${match ? formatMatchLabel(match) : prediction.matchId}`,
    `Predicted score: ${formatPredictionLabel(prediction)}`,
    `Points: ${prediction.pointsAwarded}`,
  ].join("\n");

  return {
    title,
    text,
    url: buildShareUrl(origin, locale, { success: SHARE_SUCCESS.PREDICTION, matchId: prediction.matchId }),
  };
}

function buildPerformanceSummaryShareContent(
  origin: string,
  locale: string,
  username: string,
  rankingEntry: RankingEntry,
  t: Awaited<ReturnType<typeof getTranslations<"share">>>,
): ShareContent {
  const title = t("templates.mySquadPerformance");
  const text = [
    title,
    `${username} is #${rankingEntry.position} with ${rankingEntry.totalPoints} points`,
    `Exact predictions: ${rankingEntry.exactPredictions}`,
    `Saved predictions: ${rankingEntry.predictionsCount}`,
  ].join("\n");

  return {
    title,
    text,
    url: buildShareUrl(origin, locale, { success: SHARE_SUCCESS.PERFORMANCE_SUMMARY }),
  };
}

function buildGroupRankingShareContent(
  origin: string,
  locale: string,
  username: string,
  groupName: string,
  rankingEntry: RankingEntry,
  groupId: string,
  t: Awaited<ReturnType<typeof getTranslations<"share">>>,
): ShareContent {
  const title = t("templates.groupStanding");
  const text = [
    title,
    groupName,
    `${username} is #${rankingEntry.position} with ${rankingEntry.totalPoints} points`,
  ].join("\n");

  return {
    title,
    text,
    url: buildShareUrl(origin, locale, { success: SHARE_SUCCESS.GROUP_RANKING, groupId }),
  };
}

function getShareErrorCode(error: unknown, kind: "prediction" | "performance" | "group"): string {
  if (!(error instanceof ApiError)) {
    return "createFailed";
  }

  if (error.status === 401) {
    return "sessionExpired";
  }

  if (error.status === 403 && kind !== "group") {
    return "sessionExpired";
  }

  if (kind === "prediction") {
    if (error.status === 404) {
      return "predictionNotFound";
    }
    return error.status === 400 ? "invalidInput" : "createFailed";
  }

  if (kind === "performance") {
    if (error.status === 404) {
      return "performanceNotReady";
    }
    return error.status === 400 ? "invalidInput" : "createFailed";
  }

  if (error.status === 403) {
    return "groupForbidden";
  }

  if (error.status === 404) {
    return "groupNotReady";
  }

  return error.status === 400 ? "invalidInput" : "createFailed";
}

function PredictionShareTemplate({ predictionOption, predictedBy, captureTargetId, shareActions, locale, t }: PredictionShareTemplateProps) {
  const match = predictionOption?.match ?? null;
  const prediction = predictionOption?.prediction ?? null;

  return (
    <article id="prediction-preview" className="relative scroll-mt-24 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950 p-5 shadow-2xl shadow-cyan-950/30">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.18),transparent_32%)]" />

      <div
        id={captureTargetId}
        className="relative mx-auto max-w-sm rounded-[1.75rem] border border-cyan-300/40 bg-slate-950/80 p-5 shadow-2xl shadow-cyan-500/10 backdrop-blur"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.8)), url(/assets/WCLogo.png)",
          backgroundPosition: "center",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
        }}
      >
        <p className="text-center text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">{t("templates.shareMyPrediction")}</p>

        <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("templates.predictedBy")}</p>
          <p className="mt-1 truncate text-base font-semibold text-white">{predictedBy}</p>
        </div>

        <div className="mt-5">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-slate-300">{t("templates.selectedMatch")}</p>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="rounded-3xl border border-cyan-300/30 bg-cyan-400/10 p-4 text-center">
              <p className="flex items-center justify-center" aria-hidden="true">
                <FlagIcon flagCode={match?.homeTeam.flagCode ?? null} countryCode={match?.homeTeam.countryCode ?? null} size="2.75rem" />
              </p>
              <p className="mt-2 text-xl font-black text-white">{match?.homeTeam.shortName ?? "---"}</p>
              <p className="mt-1 truncate text-xs text-cyan-100/70">{match?.homeTeam.name ?? t("templates.homeTeam")}</p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">vs</span>
            <div className="rounded-3xl border border-violet-300/30 bg-violet-400/10 p-4 text-center">
              <p className="flex items-center justify-center" aria-hidden="true">
                <FlagIcon flagCode={match?.awayTeam.flagCode ?? null} countryCode={match?.awayTeam.countryCode ?? null} size="2.75rem" />
              </p>
              <p className="mt-2 text-xl font-black text-white">{match?.awayTeam.shortName ?? "---"}</p>
              <p className="mt-1 truncate text-xs text-violet-100/70">{match?.awayTeam.name ?? t("templates.awayTeam")}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 mb-2 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-300">{t("templates.predictedScore")}</p>
          <p className="mt-4 flex items-center justify-center gap-6 text-5xl font-black tabular-nums text-white">
            <span>{prediction?.homeScore ?? "?"}</span>
            <span className="text-slate-500">–</span>
            <span>{prediction?.awayScore ?? "?"}</span>
          </p>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("templates.matchContext")}</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {match ? `${match.stage}${match.groupName ? ` · ${match.groupName}` : ""}` : t("templates.previewCardBeforeSharing")}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {match ? formatDate(match.kickoffAt, locale) : t("templates.previewCardBeforeSharing")}
          </p>
        </div>

        <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t("templates.shareWithYourCrew")}</p>

        {prediction ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{t("templates.points")}</p>
              <p className="mt-1 text-sm font-bold text-white">{prediction.pointsAwarded}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{t("templates.status")}</p>
              <p className="mt-1 truncate text-sm font-bold text-white">{prediction.scoringStatus}</p>
            </div>
          </div>
        ) : null}
      </div>

      {shareActions ? <div className="relative mt-4">{shareActions}</div> : null}
    </article>
  );
}

function PerformanceSummaryShareTemplate({
  rankingEntry,
  displayName,
  countryLabel,
  leaderboardCount,
  captureTargetId,
  shareActions,
  locale,
  t,
}: PerformanceSummaryShareTemplateProps) {
  return (
    <article id="performance-preview" className="relative scroll-mt-24 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950 p-5 shadow-2xl shadow-cyan-950/30">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.16),transparent_32%)]" />

      <div
        id={captureTargetId}
        className="relative mx-auto max-w-sm overflow-hidden rounded-[1.75rem] border border-cyan-300/40 bg-slate-950/85 p-5 shadow-2xl shadow-cyan-500/10 backdrop-blur"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.8)), url(/assets/WCLogo.png)",
          backgroundPosition: "center",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-400 via-cyan-300 to-violet-400" />

        <div className="relative text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">{t("templates.mySquadPerformance")}</p>
          <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/40 bg-slate-900/70 text-4xl shadow-lg shadow-cyan-500/10">
            <span aria-hidden="true">👤</span>
          </div>
          <p className="mt-3 truncate text-lg font-black text-white">{displayName}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{countryLabel ?? t("templates.countryLabelDefault")}</p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-3xl border border-violet-400/25 bg-gradient-to-r from-violet-500/30 via-violet-400/15 to-cyan-400/15 p-4">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">{t("templates.totalPoints")}</p>
            <p className="mt-3 text-center text-4xl font-black tabular-nums text-white">{rankingEntry ? rankingEntry.totalPoints : "---"}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-cyan-300/20 bg-slate-900/75 p-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("templates.exactPicks")}</p>
              <p className="mt-2 text-3xl font-black text-white tabular-nums">{rankingEntry ? rankingEntry.exactPredictions : "--"}</p>
            </div>
            <div className="rounded-3xl border border-cyan-300/20 bg-slate-900/75 p-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("templates.rank")}</p>
              <p className="mt-2 text-3xl font-black text-white tabular-nums">{rankingEntry ? `#${rankingEntry.position}` : "--"}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-300/20 bg-slate-900/75 p-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("templates.savedPredictions")}</p>
            <p className="mt-2 text-3xl font-black text-white tabular-nums">{rankingEntry ? rankingEntry.predictionsCount : "--"}</p>
          </div>

          <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-violet-500/30 via-cyan-400/20 to-cyan-300/30 p-4">
            <p className="text-lg font-black uppercase leading-6 text-white">{t("templates.subtleCelebration")}</p>
            <p className="mt-1 text-sm text-white/80">
              {rankingEntry ? t("templates.topOfLeaderboard", { position: Math.min(rankingEntry.position, leaderboardCount), total: leaderboardCount }) : t("templates.progressNotReady")}
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{t("templates.shareWithYourSquad")}</p>
      </div>

      {shareActions ? <div className="relative mt-4">{shareActions}</div> : null}
    </article>
  );
}

function GroupShareTemplate({ group, rankingEntry, previewId, captureTargetId, shareActions, locale, t }: GroupShareTemplateProps) {
  return (
    <article id={previewId} className="relative scroll-mt-24 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950 p-5 shadow-2xl shadow-cyan-950/30">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.2),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.16),transparent_32%)]" />

      <div
        id={captureTargetId}
        className="relative mx-auto max-w-sm overflow-hidden rounded-[1.75rem] border border-cyan-300/40 bg-slate-950/85 p-5 shadow-2xl shadow-cyan-500/10 backdrop-blur"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.8)), url(/assets/WCLogo.png)",
          backgroundPosition: "center",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-400 via-cyan-300 to-violet-400" />

        <div className="relative text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">{t("templates.groupStanding")}</p>
          <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/40 bg-slate-900/70 text-4xl shadow-lg shadow-cyan-500/10">
            <span aria-hidden="true">🏆</span>
          </div>
          <p className="mt-3 truncate text-lg font-black text-white">{group?.name ?? t("templates.chooseAGroup")}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{t("templates.shareYourSquadTable")}</p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-3xl border border-violet-400/25 bg-gradient-to-r from-violet-500/30 via-violet-400/15 to-cyan-400/15 p-4">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">{t("templates.currentPlace")}</p>
            <p className="mt-3 text-center text-4xl font-black tabular-nums text-white">{rankingEntry ? `#${rankingEntry.position}` : "---"}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-cyan-300/20 bg-slate-900/75 p-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("templates.points")}</p>
              <p className="mt-2 text-3xl font-black text-white tabular-nums">{rankingEntry ? rankingEntry.totalPoints : "--"}</p>
            </div>
            <div className="rounded-3xl border border-cyan-300/20 bg-slate-900/75 p-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("templates.savedPredictions")}</p>
              <p className="mt-2 text-3xl font-black text-white tabular-nums">{rankingEntry ? rankingEntry.predictionsCount : "--"}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-violet-500/30 via-cyan-400/20 to-cyan-300/30 p-4">
            <p className="text-lg font-black uppercase leading-6 text-white">{t("templates.squadSnapshot")}</p>
            <p className="mt-1 text-sm text-white/80">
              {rankingEntry
                ? t("templates.groupLiveMessage", { points: rankingEntry.totalPoints, count: rankingEntry.predictionsCount })
                : t("templates.pickGroupToPreview")}
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{t("templates.shareWithYourSquad")}</p>
      </div>

      {shareActions ? <div className="relative mt-4">{shareActions}</div> : null}
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
        backgroundSize: "cover",
        backgroundPosition: "center",
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

const PREVIEW_HASH = {
  prediction: "#prediction-preview",
  performance: "#performance-preview",
  group: "#group-preview",
} as const;

export default async function SharePage({ searchParams, params }: SharePageProps) {
  const { locale } = await params;
  const t = await getTranslations("share");

  const session = await auth0.getSession();

  if (!session) {
    redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/share")}`);
  }

  // Resolve selected tournament from cookie (null → API uses ACTIVE fallback)
  const tournamentSlug = await resolveTournamentSlug();

  const resolvedSearchParams = await searchParams;

  let accessToken: string;

  try {
    accessToken = (await auth0.getAccessToken()).token;
  } catch {
    redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/share")}`);
  }

  const [currentUserProfile, matches, predictions, myGroups, globalRanking] = await Promise.all([
    getCurrentUserProfile(accessToken).catch(() => null),
    getActiveTournamentMatches(tournamentSlug).catch(() => [] as MatchView[]),
    getMyPredictions(accessToken).catch(() => [] as PredictionView[]),
    getMyGroups(accessToken, tournamentSlug).catch(() => [] as MyGroupView[]),
    getGlobalRanking(tournamentSlug).catch(() => [] as RankingEntry[]),
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
    ? buildPredictionShareContent(shareOrigin, locale, shareUsername, selectedPrediction, t)
    : null;
  const performanceSummaryShareContent = currentUserRankingEntry
    ? buildPerformanceSummaryShareContent(shareOrigin, locale, shareUsername, currentUserRankingEntry, t)
    : null;
  const groupRankingShareContent = selectedGroup && selectedGroupRanking[0]
    ? buildGroupRankingShareContent(shareOrigin, locale, shareUsername, selectedGroup.name, selectedGroupRanking[0], selectedGroup.id, t)
    : null;

  async function submitPredictionPreview(formData: FormData) {
    "use server";

    const matchId = String(formData.get("matchId") ?? "").trim();

    if (!matchId) {
      redirect(`${getLocalizedPath(locale as AppLocale, "/share")}?error=invalidInput${PREVIEW_HASH.prediction}`);
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/share")}`);
    }

    const tournamentSlug = await resolveTournamentSlug();

    try {
      await createPredictionShareCard(actionToken, matchId, tournamentSlug);
    } catch (error) {
      redirect(`${getLocalizedPath(locale as AppLocale, "/share")}?error=${getShareErrorCode(error, "prediction")}${PREVIEW_HASH.prediction}`);
    }

    redirect(`${getLocalizedPath(locale as AppLocale, "/share")}?success=${SHARE_SUCCESS.PREDICTION}&matchId=${matchId}${PREVIEW_HASH.prediction}`);
  }

  async function submitPerformanceSummaryPreview(_formData: FormData) {
    "use server";

    void _formData;

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/share")}`);
    }

    const tournamentSlug = await resolveTournamentSlug();

    try {
      await createMyPerformanceSummaryShareCard(actionToken, tournamentSlug);
    } catch (error) {
      redirect(`${getLocalizedPath(locale as AppLocale, "/share")}?error=${getShareErrorCode(error, "performance")}${PREVIEW_HASH.performance}`);
    }

    redirect(`${getLocalizedPath(locale as AppLocale, "/share")}?success=${SHARE_SUCCESS.PERFORMANCE_SUMMARY}${PREVIEW_HASH.performance}`);
  }

  async function submitGroupRankingPreview(formData: FormData) {
    "use server";

    const groupId = String(formData.get("groupId") ?? "").trim();

    if (!groupId) {
      redirect(`${getLocalizedPath(locale as AppLocale, "/share")}?error=invalidInput${PREVIEW_HASH.group}`);
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/share")}`);
    }

    const tournamentSlug = await resolveTournamentSlug();

    try {
      await createGroupRankingShareCard(actionToken, groupId, tournamentSlug);
    } catch (error) {
      redirect(`${getLocalizedPath(locale as AppLocale, "/share")}?error=${getShareErrorCode(error, "group")}&groupId=${groupId}${PREVIEW_HASH.group}`);
    }

    redirect(`${getLocalizedPath(locale as AppLocale, "/share")}?success=${SHARE_SUCCESS.GROUP_RANKING}&groupId=${groupId}${PREVIEW_HASH.group}`);
  }

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl">
      <section className="space-y-8 py-2 sm:py-4">
          <SectionHeader
            eyebrow={t("eyebrow.shareableSnapshots")}
            title={t("title.previewTheCard")}
            description={t("description.previewDescription")}
          />

          {resolvedSearchParams?.success ? (
            <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {t(`successMessages.${resolvedSearchParams.success as ShareSuccess}`)}
            </div>
          ) : null}

          {resolvedSearchParams?.error ? (
            <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {t(`errorMessages.${resolvedSearchParams.error}`)}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <form action={submitPredictionPreview} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("predictionForm.prediction")}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{t("predictionForm.shareYourPrediction")}</h2>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                {t("predictionForm.pickOneSaved")}
              </p>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-slate-200">{t("predictionForm.savedPrediction")}</span>
                <select
                  name="matchId"
                  defaultValue={selectedPrediction?.prediction.matchId ?? ""}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                  required
                  disabled={predictionOptions.length === 0}
                >
                  <option value="" disabled>
                    {predictionOptions.length === 0 ? t("predictionForm.noPredictionsAvailable") : t("predictionForm.choosePrediction")}
                  </option>
                  {predictionOptions.map(({ prediction, match }) => (
                    <option key={prediction.id} value={prediction.matchId}>
                      {match ? `${formatMatchLabel(match)} · ${formatPredictionLabel(prediction)}` : prediction.matchId}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">{t("predictionForm.usesYourSavedData")}</p>
                <button
                  type="submit"
                  className="w-full whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-5 sm:py-2.5 sm:text-sm"
                  disabled={predictionOptions.length === 0}
                >
                  {t("predictionForm.previewPrediction")}
                </button>
              </div>
            </form>

            <PredictionShareTemplate
              predictionOption={selectedPrediction}
              predictedBy={shareUsername}
              captureTargetId={selectedPrediction ? `prediction-share-card-${selectedPrediction.prediction.matchId}` : undefined}
              shareActions={
                predictionShareContent ? (
                  <ShareActions
                    title={predictionShareContent.title}
                    text={predictionShareContent.text}
                    url={predictionShareContent.url}
                    matchId={selectedPrediction?.prediction.matchId}
                    captureTargetId={selectedPrediction ? `prediction-share-card-${selectedPrediction.prediction.matchId}` : undefined}
                  />
                ) : (
                  <p className="text-center text-xs leading-5 text-slate-400">{t("fallback.pickPredictionToEnable")}</p>
                )
              }
              locale={locale}
              t={t}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <form action={submitPerformanceSummaryPreview} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("performanceForm.performanceSummary")}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{t("performanceForm.shareYourTournamentProgress")}</h2>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                {t("performanceForm.showYourPoints")}
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">{t("performanceForm.showYourPoints")}</p>
                <button
                  type="submit"
                  className="w-full whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 sm:w-auto sm:px-5 sm:py-2.5 sm:text-sm"
                >
                  {t("performanceForm.previewSummary")}
                </button>
              </div>
            </form>

            <PerformanceSummaryShareTemplate
              rankingEntry={currentUserRankingEntry}
              displayName={displayName}
              countryLabel={currentUserProfile ? formatCountryLabel(currentUserProfile.country) : null}
              leaderboardCount={rankingPreview.length > 0 ? rankingPreview.length : globalRanking.length}
              captureTargetId={currentUserRankingEntry ? `performance-share-card-${currentUserRankingEntry.userId}` : undefined}
              shareActions={
                performanceSummaryShareContent ? (
                  <ShareActions
                    title={performanceSummaryShareContent.title}
                    text={performanceSummaryShareContent.text}
                    url={performanceSummaryShareContent.url}
                    captureTargetId={currentUserRankingEntry ? `performance-share-card-${currentUserRankingEntry.userId}` : undefined}
                  />
                ) : null
              }
              locale={locale}
              t={t}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <form action={submitGroupRankingPreview} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("groupForm.groupStanding")}</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{t("groupForm.shareGroupStanding")}</h2>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-300">
                {t("groupForm.chooseGroup")}
              </p>

              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-slate-200">{t("groupForm.myGroups")}</span>
                <select
                  name="groupId"
                  defaultValue={selectedGroup?.id ?? ""}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                  required
                  disabled={myGroups.length === 0}
                >
                  <option value="" disabled>
                    {myGroups.length === 0 ? t("groupForm.noGroupsAvailable") : t("groupForm.chooseGroupOption")}
                  </option>
                  {myGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">{t("groupForm.showGroupInfo")}</p>
                <button
                  type="submit"
                  className="w-full whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-5 sm:py-2.5 sm:text-sm"
                  disabled={myGroups.length === 0}
                >
                  {t("groupForm.generateGroupCard")}
                </button>
              </div>
            </form>

            <GroupShareTemplate
              group={selectedGroup}
              rankingEntry={selectedGroupRanking[0] ?? null}
              previewId="group-preview"
              captureTargetId={selectedGroupRanking[0] ? `group-share-card-${selectedGroupRanking[0].userId}-${selectedGroup?.id ?? selectedGroupId ?? "group"}` : undefined}
              shareActions={
                groupRankingShareContent ? (
                  <ShareActions
                    title={groupRankingShareContent.title}
                    text={groupRankingShareContent.text}
                    url={groupRankingShareContent.url}
                    captureTargetId={selectedGroupRanking[0] ? `group-share-card-${selectedGroupRanking[0].userId}-${selectedGroup?.id ?? selectedGroupId ?? "group"}` : undefined}
                  />
                ) : selectedGroup ? (
                  <p className="text-center text-xs leading-5 text-slate-400">{t("fallback.generateCardToEnable")}</p>
                ) : null
              }
              locale={locale}
              t={t}
            />
          </div>
      </section>
    </main>
  );
}