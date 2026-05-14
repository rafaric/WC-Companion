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
import { buildPageMetadata, metadataBase, SITE_DESCRIPTION, SITE_NAME } from "@/lib/metadata";
import { formatCountryLabel, getTeamLabel, isProfileComplete } from "@/lib/profile";
import { getFriendlyDisplayName, getFriendlyEmailLabel } from "@/lib/user-display";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import Image from "next/image";

export const metadata = buildPageMetadata({
  title: "World Cup predictions with friends",
  description:
    "Predict World Cup matches, climb rankings, and compete with friends in private groups with a mobile-first experience.",
  keywords: [
    "world cup prediction app",
    "world cup bracket friends",
    "football prediction app",
    "soccer prediction game",
    "world cup predictions",
    "prediction groups",
    "friends leaderboard",
  ],
  path: "/",
});

const LANDING_STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: metadataBase.toString(),
    description: SITE_DESCRIPTION,
    inLanguage: "en",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: metadataBase.toString(),
    logo: `${metadataBase.toString().replace(/\/$/, "")}/assets/LogoLong.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    url: metadataBase.toString(),
  },
] as const;


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

const VALUE_PILLARS = [
  {
    icon: "👥",
    title: "Private groups first",
    description: "Create your circle, invite friends, and keep the competition personal.",
  },
  {
    icon: "⚡",
    title: "Fast World Cup picks",
    description: "Set exact scores for tournament fixtures in seconds, right from your phone.",
  },
  {
    icon: "📈",
    title: "Live score tension",
    description: "Watch rankings move as confirmed results hit the board and exact picks land.",
  },
] as const;

const ACCOUNT_REASSURANCE = [
  { icon: "🔐", label: "Secure sign-in" },
  { icon: "📈", label: "Live rankings" },
  { icon: "👥", label: "Private groups" },
] as const;

const FIFA_FLAG_EMOJI: Record<string, string> = {
  ARG: "🇦🇷",
  BRA: "🇧🇷",
  ENG: "🏴",
  ESP: "🇪🇸",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  POR: "🇵🇹",
  URU: "🇺🇾",
};

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

function getFlagEmoji(flagCode: string | null): string | null {
  if (!flagCode) {
    return null;
  }

  const normalizedCode = flagCode.trim().toUpperCase();

  if (FIFA_FLAG_EMOJI[normalizedCode]) {
    return FIFA_FLAG_EMOJI[normalizedCode];
  }

  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return null;
  }

  return String.fromCodePoint(...Array.from(normalizedCode).map((char) => 127397 + char.charCodeAt(0)));
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
  // Resolve selected tournament from cookie (null means user didn't set one → API uses ACTIVE fallback)
  const tournamentSlug = await resolveTournamentSlug();

  const sessionPromise = auth0.getSession();
  const tournamentPromise = getActiveTournament(tournamentSlug).catch(() => null);
  const matchesPromise = getActiveTournamentMatches(tournamentSlug).catch(() => []);
  const rankingPromise = getGlobalRanking(tournamentSlug).catch(() => []);

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
  const homeFlag = getFlagEmoji(previewMatch?.homeTeam.flagCode ?? null) ?? getFlagEmoji(previewMatch?.homeTeam.countryCode ?? null);
  const awayFlag = getFlagEmoji(previewMatch?.awayTeam.flagCode ?? null) ?? getFlagEmoji(previewMatch?.awayTeam.countryCode ?? null);
  const primaryCtaHref = user ? (profileComplete ? "/dashboard" : "/onboarding") : "/auth/login?returnTo=/dashboard";
  const primaryCtaLabel = user ? (profileComplete ? "Open dashboard" : "Complete profile") : "Log in to predict";
  const secondaryCtaHref = user ? "/groups" : "/auth/login";
  const secondaryCtaLabel = user ? "My groups" : "Secure sign in";

  return (
    <main id="main-content" tabIndex={-1} className="relative overflow-hidden bg-slate-950 text-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_STRUCTURED_DATA) }}
      />
      <div className="worldpredict-aurora absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 rounded-full border border-slate-800/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              <Image src="/icon.svg" alt="WorldPredict logo" width={24} height={24} />
              WorldPredict
            </p>
            <p className="text-xs text-slate-400">Social football prediction</p>
          </div>
          {user ? (
            <div className="min-w-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-right text-xs text-emerald-300">
              <p className="truncate font-medium text-emerald-200">{accountLabel}</p>
              <p className="truncate text-[11px] text-emerald-400/80">{accountEmail ?? "Authenticated"}</p>
            </div>
          ) : (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Private groups ready
            </span>
          )}
        </header>

        <section className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:py-16">
          <div className="space-y-7 lg:space-y-8">
            <div className="space-y-4 sm:space-y-5">
              <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                {formatTournamentLabel(activeTournament)}
              </p>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  World Cup predictions feel better when <span className="text-cyan-300">the rivalry is personal.</span>
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  WorldPredict keeps the tournament focused on quick match picks, private groups,
                  and live rankings that make every confirmed World Cup result matter.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryCtaHref}
                className="rounded-full bg-gradient from-cyan-400 via-blue-400 to-violet-400 px-6 py-3 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 sm:min-w-40"
              >
                {primaryCtaLabel}
              </Link>
              <Link
                href={secondaryCtaHref}
                className="rounded-full border border-slate-700 bg-slate-900/80 px-6 py-3 text-center text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800 sm:min-w-40"
              >
                {secondaryCtaLabel}
              </Link>
              {user ? (
                <Link
                  href="/auth/logout"
                  className="rounded-full border border-slate-700 bg-slate-900/80 px-6 py-3 text-center text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  Log out
                </Link>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-300">
              {ACCOUNT_REASSURANCE.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-slate-300"
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </span>
              ))}
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

            <div className="grid gap-4 md:grid-cols-3">
              {VALUE_PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur sm:p-5"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span aria-hidden="true">{pillar.icon}</span>
                    {pillar.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{pillar.description}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4 rounded-[2rem] border border-slate-800/80 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-5">
            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Match to watch</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {previewMatch ? `${previewMatch.homeTeam.name} vs ${previewMatch.awayTeam.name}` : "No matches scheduled"}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  {formatMatchStatus(previewMatch)}
                </div>
              </div>

              {previewMatch ? (
                <>
                  <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                    <div className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
                      <p className="text-3xl" aria-hidden="true">{homeFlag ?? "⚽"}</p>
                      <p className="mt-2 text-lg font-black text-white">{previewMatch.homeTeam.shortName}</p>
                      <p className="truncate text-xs text-slate-400">{previewMatch.homeTeam.name}</p>
                    </div>
                    <div className="rounded-full border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      VS
                    </div>
                    <div className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
                      <p className="text-3xl" aria-hidden="true">{awayFlag ?? "⚽"}</p>
                      <p className="mt-2 text-lg font-black text-white">{previewMatch.awayTeam.shortName}</p>
                      <p className="truncate text-xs text-slate-400">{previewMatch.awayTeam.name}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                    <p>
                      {previewMatch.stage}
                      {previewMatch.groupName ? ` · ${previewMatch.groupName}` : ""}
                    </p>
                    <p className="mt-1 text-slate-400">Kickoff {formatKickoff(previewMatch.kickoffAt)}</p>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  The backend has not published upcoming matches yet.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">How it works</p>
                  <p className="mt-1 text-sm text-slate-500">Three fast steps from pick to bragging rights.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {STEPS.map((step) => (
                  <div key={step.number} className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
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

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {user ? "Your account" : "Ready when you are"}
              </p>
              {user ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="font-semibold text-white">{accountLabel}</p>
                    <p className="text-sm text-slate-400">{accountEmail ?? "Authenticated account"}</p>
                    {currentUserProfile ? (
                      <p className="mt-1 text-xs text-cyan-300">
                        {profileComplete
                          ? "Profile ready to compete."
                          : "Finish your profile to unlock your full summary."}
                      </p>
                    ) : currentUserProfileError ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Profile details are temporarily unavailable, but your session is active.
                      </p>
                    ) : null}
                  </div>

                  {currentUserProfile ? (
                    profileComplete ? (
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Country</p>
                          <p className="mt-1 font-semibold text-white">{formatCountryLabel(currentUserProfile.country)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Favorite team</p>
                          <p className="mt-1 font-semibold text-white">{getTeamLabel(favoriteTeam)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Preferred language</p>
                          <p className="mt-1 font-semibold text-white">
                            {currentUserProfile.preferredLanguage ?? "Not set"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Username</p>
                          <p className="mt-1 font-semibold text-white">{currentUserProfile.username}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-200">
                        Add your country and favorite team so the app can personalize your competition view.
                      </div>
                    )
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/onboarding"
                      className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-300"
                    >
                      {profileComplete ? "Edit profile" : "Finish profile"}
                    </Link>
                    <Link href="/groups" className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200">
                      Open groups
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-6 text-slate-400">
                    Sign in to save predictions, join private groups, and follow the ranking as results are confirmed.
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                    {ACCOUNT_REASSURANCE.map((item) => (
                      <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5">
                        <span aria-hidden="true">{item.icon}</span>
                        {item.label}
                      </span>
                    ))}
                  </div>
                  <Link href="/auth/login?returnTo=/" className="inline-flex text-sm font-medium text-cyan-300">
                    Log in
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live competition snapshot</p>
              {rankingLeader ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">#{rankingLeader.position} {rankingLeader.username}</p>
                      <p className="text-sm text-slate-400">{ranking.length} players currently ranked</p>
                    </div>
                    <p className="text-lg font-black text-cyan-300">{rankingLeader.totalPoints} pts</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center text-sm">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                      <p className="text-lg font-bold text-white">{rankingLeader.exactPredictions}</p>
                      <p className="text-xs text-slate-400">Exact picks</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                      <p className="text-lg font-bold text-white">{rankingLeader.predictionsCount}</p>
                      <p className="text-xs text-slate-400">Predictions made</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  No public ranking data yet. As soon as results are confirmed, the board starts moving.
                </p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
