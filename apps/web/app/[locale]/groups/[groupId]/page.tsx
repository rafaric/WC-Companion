import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import { ApiError, getCurrentUserProfile, getGroupRanking, getMyGroups, type MyGroupView, type RankingEntry } from "@/lib/api";
import { cn } from "@/lib/cn";
import { buildPageMetadata } from "@/lib/metadata";
import { getFriendlyDisplayName } from "@/lib/user-display";
import { CopyInviteCodeButton } from "../copy-invite-code-button";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";

export const metadata = buildPageMetadata({
  title: "Group ranking",
  description: "Track your private group leaderboard after confirmed football results land.",
  index: false,
  path: "/groups",
});

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

function formatLastScoredAt(value: string | null): string {
  if (!value) {
    return "No scored predictions yet";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getGroupRoleLabel(role: MyGroupView["role"]): string {
  return role === "OWNER" ? "Owner" : "Member";
}

function formatMemberCount(memberCount: number): string {
  return `${memberCount} ${memberCount === 1 ? "member" : "members"}`;
}

function getLeader(ranking: RankingEntry[]): RankingEntry | null {
  return ranking[0] ?? null;
}

function getLatestScoredEntry(ranking: RankingEntry[]): RankingEntry | null {
  return ranking
    .filter((entry) => entry.lastScoredAt !== null)
    .slice()
    .sort((left, right) => new Date(right.lastScoredAt ?? 0).getTime() - new Date(left.lastScoredAt ?? 0).getTime())[0] ?? null;
}

function getPointsBehindLeader(currentUserEntry: RankingEntry | null, leader: RankingEntry | null): number | null {
  if (!currentUserEntry || !leader || currentUserEntry.userId === leader.userId) {
    return null;
  }

  return Math.max(leader.totalPoints - currentUserEntry.totalPoints, 0);
}

function getPositionContext(currentUserEntry: RankingEntry | null, leader: RankingEntry | null): string {
  if (!currentUserEntry) {
    return "Score your first prediction to enter this group ranking.";
  }

  const pointsBehind = getPointsBehindLeader(currentUserEntry, leader);

  if (pointsBehind === null) {
    return "You are leading this group. No aflojes ahora.";
  }

  if (pointsBehind === 0) {
    return "You are tied with the leader. One exact result can break it.";
  }

  return `${pointsBehind} ${pointsBehind === 1 ? "point" : "points"} behind the leader.`;
}

function getSingleMemberInviteMessage(group: MyGroupView | null): string {
  if (!group) {
    return "Invite friends from your groups list to turn this into a real competition.";
  }

  return "Share the code with friends so the leaderboard starts moving.";
}

function looksTechnicalUsername(username: string): boolean {
  const normalized = username.trim();

  return (
    /^\d+$/.test(normalized) ||
    /^[a-f0-9]{12,}$/i.test(normalized) ||
    /^[a-f0-9-]{20,}$/i.test(normalized) ||
    normalized.startsWith("auth0-")
  );
}

function getRankingDisplayName(entry: RankingEntry, currentUserId: string | null, currentUserDisplayName: string): string {
  if (entry.userId === currentUserId) {
    return currentUserDisplayName;
  }

  if (looksTechnicalUsername(entry.username)) {
    return `Player #${entry.position}`;
  }

  return entry.username;
}

function PodiumCard({
  entry,
  isCurrentUser,
  currentUserId,
  currentUserDisplayName,
}: {
  entry: RankingEntry;
  isCurrentUser: boolean;
  currentUserId: string | null;
  currentUserDisplayName: string;
}) {
  const isLeader = entry.position === 1;
  const displayName = getRankingDisplayName(entry, currentUserId, currentUserDisplayName);

  return (
    <article
      className={cn(
        "rounded-3xl border p-4 shadow-xl shadow-slate-950/20 transition",
        isLeader
          ? "border-amber-300/30 bg-gradient-to-br from-amber-400/15 via-slate-900/80 to-slate-950 shadow-amber-950/20"
          : isCurrentUser
            ? "border-cyan-400/40 bg-cyan-400/10"
            : "border-slate-800 bg-slate-950/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-xs uppercase tracking-[0.2em]", isLeader ? "text-amber-200" : "text-slate-500")}>
            {isLeader ? "Leader" : `#${entry.position}`}
          </p>
          <p className="mt-1 truncate text-lg font-black text-white">{displayName}</p>
          <p className={cn("mt-1 text-sm", isLeader ? "text-amber-100/80" : "text-slate-400")}>
            {entry.totalPoints} points · {entry.exactPredictions} exact
          </p>
        </div>
        {isCurrentUser ? (
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
            You
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <RankingStats label="Pts" value={entry.totalPoints} />
        <RankingStats label="Exact" value={entry.exactPredictions} />
        <RankingStats label="Pred" value={entry.predictionsCount} />
      </div>
    </article>
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

function RankingRow({
  entry,
  isCurrentUser,
  currentUserId,
  currentUserDisplayName,
}: {
  entry: RankingEntry;
  isCurrentUser: boolean;
  currentUserId: string | null;
  currentUserDisplayName: string;
}) {
  const displayName = getRankingDisplayName(entry, currentUserId, currentUserDisplayName);

  return (
    <li
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3",
        isCurrentUser ? "border-cyan-400/40 bg-cyan-400/10" : "border-slate-800 bg-slate-950/60",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-white">
            #{entry.position} {displayName}
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
      <p className="shrink-0 text-lg font-black text-cyan-300">{entry.totalPoints} pts</p>
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

  const tournamentSlug = await resolveTournamentSlug();

  const [currentUserProfile, myGroups, rankingResult] = await Promise.all([
    getCurrentUserProfile(accessToken).catch(() => null),
    getMyGroups(accessToken, tournamentSlug).catch(() => [] as MyGroupView[]),
    getGroupRanking(accessToken, groupId)
      .then((ranking) => ({ ranking, error: null as string | null }))
      .catch((error: unknown) => ({ ranking: [] as RankingEntry[], error: getRankingErrorMessage(error) })),
  ]);

  const group = myGroups.find((candidate) => candidate.id === groupId) ?? null;
  const currentUserRankingEntry = currentUserProfile
    ? rankingResult.ranking.find((entry) => entry.userId === currentUserProfile.id) ?? null
    : null;
  const leader = getLeader(rankingResult.ranking);
  const latestScoredEntry = getLatestScoredEntry(rankingResult.ranking);
  const podiumEntries = rankingResult.ranking.slice(0, 3);
  const remainingEntries = rankingResult.ranking.slice(3);
  const scoredPlayersCount = rankingResult.ranking.filter((entry) => entry.lastScoredAt !== null).length;
  const isSingleMemberGroup = rankingResult.ranking.length === 1;
  const currentUserDisplayName = currentUserProfile ? getFriendlyDisplayName(session.user, currentUserProfile) : "You";
  const currentUserId = currentUserProfile?.id ?? null;
  const leaderDisplayName = leader ? getRankingDisplayName(leader, currentUserId, currentUserDisplayName) : null;
  const latestScoredDisplayName = latestScoredEntry
    ? getRankingDisplayName(latestScoredEntry, currentUserId, currentUserDisplayName)
    : null;

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl">
      <section className="space-y-6 py-2 sm:py-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              Private leaderboard
            </p>
            {group ? (
              <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300 sm:hidden">
                {getGroupRoleLabel(group.role)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {group?.name ?? `Group ${groupId}`}
            </h1>
            {group ? (
              <span className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300 sm:inline-flex">
                {getGroupRoleLabel(group.role)}
              </span>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Track your crew after every scored match. The board updates when confirmed results recalculate predictions.
          </p>
          {group ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1">{formatMemberCount(group.memberCount)}</span>
              <CopyInviteCodeButton inviteCode={group.inviteCode} />
            </div>
          ) : null}
        </div>

          {rankingResult.error ? (
            <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {rankingResult.error}
            </div>
          ) : null}

          {isSingleMemberGroup ? (
            <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/15 via-slate-900/80 to-slate-950 p-5 shadow-xl shadow-amber-950/20">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Invite your first rival</p>
                  <h2 className="mt-2 text-2xl font-black text-white">You are alone in this group.</h2>
                  <p className="mt-2 text-sm leading-6 text-amber-100/80">
                    {getSingleMemberInviteMessage(group)} Rankings get interesting once friends join, predict, and results
                    start moving the table.
                  </p>
                </div>

                <div className="rounded-3xl border border-amber-300/20 bg-slate-950/55 p-4 lg:min-w-80">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Share this code</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-mono text-2xl font-black tracking-[0.18em] text-white">{group?.inviteCode ?? "Unavailable"}</p>
                    {group ? <CopyInviteCodeButton inviteCode={group.inviteCode} /> : null}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-amber-100/70">Friends can join from the Groups page with this code.</p>
                </div>
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-400/15 via-slate-900/80 to-slate-950 p-5 shadow-2xl shadow-amber-950/20 md:col-span-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Leader</p>
                  {leader ? (
                    <>
                      <p className="mt-2 text-3xl font-black text-white">#{leader.position}</p>
                      <p className="mt-1 truncate text-xl font-semibold text-white">{leaderDisplayName}</p>
                      <p className="mt-1 text-sm text-amber-100/80">{leader.totalPoints} points</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-amber-50/80">No leader yet.</p>
                  )}
                </div>
                {leader ? (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border border-amber-300/30 bg-slate-950/70 shadow-lg shadow-amber-500/10">
                    <span className="text-xl font-black text-amber-200">#1</span>
                  </div>
                ) : null}
              </div>
              {leader ? <p className="mt-4 text-sm leading-6 text-amber-50/80">The current front-runner sets the pace for the group.</p> : null}
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latest scoring update</p>
              {latestScoredEntry ? (
                <>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xl font-black text-white">{latestScoredDisplayName}</p>
                      <p className="mt-1 text-sm text-slate-300">#{latestScoredEntry.position} · {latestScoredEntry.totalPoints} points</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-emerald-300">{latestScoredEntry.exactPredictions} exact</p>
                      <p className="mt-1 text-xs text-slate-500">{formatLastScoredAt(latestScoredEntry.lastScoredAt)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-400">This shows the most recent player whose points changed after a scored result.</p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-300">No scored predictions yet.</p>
              )}
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Competition</p>
              <p className="mt-2 text-3xl font-black text-white">
                {scoredPlayersCount}/{rankingResult.ranking.length}
              </p>
              <p className="mt-1 text-sm text-slate-300">players with scored predictions</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ranking</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Current positions</h2>
              </div>
              <p className="text-sm text-slate-400">{rankingResult.ranking.length} players</p>
            </div>

            {currentUserRankingEntry ? (
              <div className="mt-4 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-slate-900/80 to-violet-400/10 p-4 shadow-xl shadow-cyan-950/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/30 bg-slate-950/70 shadow-lg shadow-cyan-500/10">
                      <span className="text-2xl font-black text-cyan-200">#{currentUserRankingEntry.position}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Your standing</p>
                      <p className="mt-1 truncate text-base font-semibold text-white">{currentUserDisplayName}</p>
                      <p className="text-xs text-cyan-100/70">{getPositionContext(currentUserRankingEntry, leader)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Points</p>
                    <p className="mt-1 text-3xl font-black tabular-nums text-white">{currentUserRankingEntry.totalPoints}</p>
                    <p className="text-xs font-semibold text-cyan-100/70">pts</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Exact</p>
                    <p className="mt-1 text-lg font-bold text-white">{currentUserRankingEntry.exactPredictions}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Predictions</p>
                    <p className="mt-1 text-lg font-bold text-white">{currentUserRankingEntry.predictionsCount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Position</p>
                    <p className="mt-1 text-lg font-bold text-white">#{currentUserRankingEntry.position}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {podiumEntries.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {podiumEntries.map((entry) => (
                    <PodiumCard
                      key={entry.userId}
                      entry={entry}
                      isCurrentUser={entry.userId === currentUserId}
                      currentUserId={currentUserId}
                      currentUserDisplayName={currentUserDisplayName}
                    />
                  ))}
              </div>
            ) : null}

            {remainingEntries.length > 0 ? (
              <div className="mt-5">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <span className="h-px flex-1 bg-slate-800" />
                  Remaining positions
                  <span className="h-px flex-1 bg-slate-800" />
                </div>
                <ul className="mt-4 space-y-3">
                  {remainingEntries.map((entry) => (
                      <RankingRow
                        key={entry.userId}
                        entry={entry}
                        isCurrentUser={entry.userId === currentUserId}
                        currentUserId={currentUserId}
                        currentUserDisplayName={currentUserDisplayName}
                      />
                    ))}
                </ul>
              </div>
            ) : rankingResult.ranking.length > 0 ? null : (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
                No ranking data yet. Invite a friend and come back after the first scores land.
              </div>
            )}

          </div>
      </section>
    </main>
  );
}
