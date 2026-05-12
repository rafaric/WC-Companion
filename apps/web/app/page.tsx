import Link from "next/link";

import { auth0 } from "@/lib/auth0";
import {
  getCurrentUserProfile,
  getActiveTournament,
  getActiveTournamentMatches,
  getGlobalRanking,
  MATCH_STATUS,
  type CurrentUserProfile,
  type MatchView,
  type RankingEntry,
  type Tournament,
} from "@/lib/api";
import { buildPageMetadata } from "@/lib/metadata";
import { formatCountryLabel, getTeamLabel, isProfileComplete } from "@/lib/profile";
import { getFriendlyDisplayName, getFriendlyEmailLabel } from "@/lib/user-display";
import Image from "next/image";

export const metadata = buildPageMetadata({
  title: "Social football predictions",
  description:
    "Predict football matches, climb rankings, and compete with friends in private groups with a mobile-first experience.",
  path: "/",
});


const STEPS = [
  {
    number: "01",
    title: "Predict",
    description: "Pick exact match scores in seconds, right from your phone.",
  },
  {
    number: "02",
    title: "Score",
    description: "Earn points when matches finish — the ranking stays backend-owned.",
  },
  {
    number: "03",
    title: "Compete",
    description: "Climb leaderboards, beat friends, and share your result.",
  },
] as const;

interface LivePreviewItem {
  label: string;
  value: string;
  detail: string;
}

function formatTournamentLabel(tournament: Tournament | null): string {
  if (!tournament) {
    return "No active tournament yet";
  }

  return `${tournament.name} • ${tournament.year}`;
}

function pickPreviewMatch(matches: MatchView[]): MatchView | null {
  return matches.find((match) => match.status === MATCH_STATUS.UPCOMING) ?? matches[0] ?? null;
}

function formatMatchStatus(match: MatchView | null): string {
  if (!match) {
    return "No upcoming match";
  }

  return match.status === MATCH_STATUS.UPCOMING ? "Upcoming" : match.status;
}

function formatKickoff(kickoffAt: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(kickoffAt));
}

function buildPreviewItems(
  tournament: Tournament | null,
  ranking: RankingEntry[],
): LivePreviewItem[] {
  const leader = ranking[0] ?? null;

  return [
    {
      label: "Active tournament",
      value: tournament ? tournament.name : "Offline",
      detail: tournament ? `Season ${tournament.year}` : "Backend data unavailable",
    },
    {
      label: "Global leader",
      value: leader ? `#${leader.position} ${leader.username}` : "No rankings yet",
      detail: leader ? `${leader.totalPoints} points` : "Be the first to score",
    },
    {
      label: "Ranked players",
      value: `${ranking.length}`,
      detail: leader ? `Top exact picks: ${leader.exactPredictions}` : "Waiting for scores",
    },
  ];
}

function getTeamById(matches: MatchView[], teamId: string | null): MatchView["homeTeam"] | null {
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

export default async function HomePage() {
  const sessionPromise = auth0.getSession();
  const tournamentPromise = getActiveTournament().catch(() => null);
  const matchesPromise = getActiveTournamentMatches().catch(() => []);
  const rankingPromise = getGlobalRanking().catch(() => []);

  const [session, activeTournament, matches, ranking] = await Promise.all([
    sessionPromise,
    tournamentPromise,
    matchesPromise,
    rankingPromise,
  ]);

  const user = session?.user;
  const previewMatch = pickPreviewMatch(matches);
  const livePreview = buildPreviewItems(activeTournament, ranking);
  const rankingLeader = ranking[0] ?? null;
  let currentUserProfile: CurrentUserProfile | null = null;
  let currentUserProfileError = false;

  if (session) {
    try {
      const { token } = await auth0.getAccessToken();
      currentUserProfile = await getCurrentUserProfile(token);
    } catch {
      currentUserProfileError = true;
    }
  }

  const displayName = user ? getFriendlyDisplayName(user, currentUserProfile) : null;
  const accountLabel = user ? getFriendlyDisplayName(user, currentUserProfile) : displayName;
  const accountEmail = user ? getFriendlyEmailLabel(user, currentUserProfile) : null;
  const profileComplete = currentUserProfile ? isProfileComplete(currentUserProfile) : false;
  const favoriteTeam = currentUserProfile ? getTeamById(matches, currentUserProfile.favoriteTeamId) : null;

  return (
    <main className="relative overflow-hidden bg-slate-950 text-slate-50">
      <div className="worldpredict-aurora absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-full border border-slate-800/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            <Image src="/icon.svg" alt="WorldPredict logo" width={24} height={24} />
              WorldPredict
            </p>
            <p className="text-xs text-slate-400">Social football prediction</p>
          </div>
          {user ? (
            <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-right text-xs text-emerald-300">
              <p className="font-medium text-emerald-200">{accountLabel}</p>
              <p className="text-[11px] text-emerald-400/80">{accountEmail ?? "Authenticated"}</p>
            </div>
          ) : (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Installable app shell
            </span>
          )}
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.2fr_0.8fr] lg:py-16">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                {formatTournamentLabel(activeTournament)}
              </p>
              <h1 className="max-w-2xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Predict matches. Score points. <span className="text-cyan-300">Compete with friends.</span>
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                WorldPredict is a mobile-first football prediction platform for tournaments,
                built around friendly competition, live rankings, and shareable moments.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {user ? (
                <>
                  <Link
                    href={profileComplete ? "/dashboard" : "/onboarding"}
                    className="rounded-full bg-gradient from-cyan-400 via-blue-400 to-violet-400 px-6 py-3 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
                  >
                    {profileComplete ? "Open dashboard" : "Complete profile"}
                  </Link>
                  <Link
                    href="/groups"
                    className="rounded-full border border-slate-700 bg-slate-900/80 px-6 py-3 text-center text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
                  >
                    My groups
                  </Link>
                  <Link
                    href="/auth/logout"
                    className="rounded-full border border-slate-700 bg-slate-900/80 px-6 py-3 text-center text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
                  >
                    Log out
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login?returnTo=/dashboard"
                    className="rounded-full bg-gradient from-cyan-400 via-blue-400 to-violet-400 px-6 py-3 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
                  >
                    Log in to predict
                  </Link>
                  <Link
                    href="/auth/login"
                    className="rounded-full border border-slate-700 bg-slate-900/80 px-6 py-3 text-center text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
                  >
                    Sign in with Auth0
                  </Link>
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {livePreview.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-800/80 bg-slate-900/70 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur">
            <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Upcoming match</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {previewMatch ? `${previewMatch.homeTeam.name} vs ${previewMatch.awayTeam.name}` : "No matches scheduled"}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  {formatMatchStatus(previewMatch)}
                </div>
              </div>

              {previewMatch ? (
                <>
                  <div className="grid grid-cols-3 gap-3 py-4 text-center">
                    <div className="rounded-2xl bg-slate-900 p-3">
                      <p className="text-2xl font-black text-white">{previewMatch.homeTeam.shortName}</p>
                      <p className="text-xs text-slate-400">Home</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900 p-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">VS</p>
                    </div>
                    <div className="rounded-2xl bg-slate-900 p-3">
                      <p className="text-2xl font-black text-white">{previewMatch.awayTeam.shortName}</p>
                      <p className="text-xs text-slate-400">Away</p>
                    </div>
                  </div>

                  <p className="pb-4 text-sm text-slate-400">
                    {previewMatch.stage}
                    {previewMatch.groupName ? ` · ${previewMatch.groupName}` : ""} · {formatKickoff(previewMatch.kickoffAt)}
                  </p>
                </>
              ) : (
                <div className="py-4 text-sm text-slate-400">
                  The backend has not published upcoming matches yet.
                </div>
              )}

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Global ranking</p>
                {rankingLeader ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          #{rankingLeader.position} {rankingLeader.username}
                        </p>
                        <p className="text-sm text-slate-400">{ranking.length} players on the board</p>
                      </div>
                      <p className="text-lg font-black text-cyan-300">{rankingLeader.totalPoints} pts</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center text-sm">
                      <div className="rounded-2xl bg-slate-900 p-3">
                        <p className="text-lg font-bold text-white">{rankingLeader.exactPredictions}</p>
                        <p className="text-xs text-slate-400">Exact picks</p>
                      </div>
                      <div className="rounded-2xl bg-slate-900 p-3">
                        <p className="text-lg font-bold text-white">{rankingLeader.predictionsCount}</p>
                        <p className="text-xs text-slate-400">Predictions</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    No public ranking data yet. Be the first to score when the tournament starts.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">How it works</p>
                <div className="mt-4 space-y-3">
                  {STEPS.map((step) => (
                    <div key={step.number} className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-full bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-300">
                        {step.number}
                      </span>
                      <div>
                        <p className="font-semibold text-white">{step.title}</p>
                        <p className="text-sm leading-6 text-slate-400">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Auth0 session</p>
                {user ? (
                  <div className="mt-3 space-y-1">
                    <p className="font-semibold text-white">{accountLabel}</p>
                    <p className="text-sm text-slate-400">{user.email ?? "Logged in"}</p>
                    {currentUserProfile ? (
                      <p className="text-xs text-cyan-300">
                        Synced profile: {currentUserProfile.country ?? "country pending"}
                      </p>
                    ) : currentUserProfileError ? (
                      <p className="text-xs text-slate-500">
                        Backend profile unavailable; using Auth0 session only.
                      </p>
                    ) : null}
                    <Link href="/auth/logout" className="inline-flex text-sm font-medium text-cyan-300">
                      Log out
                    </Link>
                  </div>
                ) : (
                  <div className="mt-3 space-y-1">
                    <p className="font-semibold text-white">Guest mode</p>
                    <p className="text-sm text-slate-400">Log in to sync your predictions and ranking.</p>
                    <Link href="/auth/login?returnTo=/" className="inline-flex text-sm font-medium text-cyan-300">
                      Log in
                    </Link>
                  </div>
                )}
              </div>

              {currentUserProfile ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Profile status</p>
                      <p className="mt-1 font-semibold text-white">{profileComplete ? "Complete" : "Needs setup"}</p>
                    </div>
                    <Link
                      href="/onboarding"
                      className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300"
                    >
                      {profileComplete ? "Edit" : "Finish now"}
                    </Link>
                  </div>
                  {profileComplete ? (
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Country</p>
                        <p className="mt-1 font-semibold text-white">{formatCountryLabel(currentUserProfile.country)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Favorite team</p>
                        <p className="mt-1 font-semibold text-white">{getTeamLabel(favoriteTeam)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preferred language</p>
                        <p className="mt-1 font-semibold text-white">
                          {currentUserProfile.preferredLanguage ?? "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Username</p>
                        <p className="mt-1 font-semibold text-white">{currentUserProfile.username}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-amber-300">
                      Finish country and favorite team to unlock your profile summary.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
