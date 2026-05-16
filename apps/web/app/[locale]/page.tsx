import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Metadata } from "next";

import { auth0 } from "@/lib/auth0";
import {
  getCurrentUserProfile,
  getActiveTournament,
  getActiveTournamentMatches,
  getGlobalRanking,
  MATCH_STATUS,
  type MatchView,
  type RankingEntry,
  type Tournament,
} from "@/lib/api";
import { buildPageMetadata, metadataBase, SITE_DESCRIPTION, SITE_NAME } from "@/lib/metadata";
import { formatCountryLabel, getTeamLabel, isProfileComplete } from "@/lib/profile";
import { getFriendlyDisplayName, getFriendlyEmailLabel } from "@/lib/user-display";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import { FlagIcon } from "@/components/FlagIcon";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getLocalizedPath, type AppLocale } from "@/lib/locale-nav";

export default async function LocaleHomePage() {
  const locale = await getLocale();
  const t = await getTranslations("landing");

  const session = await auth0.getSession();

  if (!session) {
    redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/dashboard")}`);
  }

  const tournamentSlug = await resolveTournamentSlug();

  const [activeTournament, matches, ranking] = await Promise.all([
    getActiveTournament(tournamentSlug).catch(() => null),
    getActiveTournamentMatches(tournamentSlug).catch(() => []),
    getGlobalRanking(tournamentSlug).catch(() => [] as RankingEntry[]),
  ]);

  const user = session.user;
  let currentUserProfile = null;
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
  const profileComplete = currentUserProfile ? isProfileComplete(currentUserProfile) : false;
  const primaryCtaHref = user ? (profileComplete ? getLocalizedPath(locale as AppLocale, "/dashboard") : getLocalizedPath(locale as AppLocale, "/onboarding")) : "/auth/login";
  const primaryCtaLabel = user ? (profileComplete ? t("cta.openDashboard") : t("cta.completeProfile")) : t("cta.logInToPredict");
  const secondaryCtaHref = user ? getLocalizedPath(locale as AppLocale, "/groups") : "/auth/login";
  const secondaryCtaLabel = user ? t("cta.myGroups") : t("cta.secureSignIn");

  const previewMatch = matches.find((m) => m.status === MATCH_STATUS.UPCOMING) ?? matches[0] ?? null;

  const leader = ranking[0] ?? null;

  return (
    <main id="main-content" tabIndex={-1} className="relative overflow-hidden bg-slate-950 text-slate-50">
      <div className="worldpredict-aurora absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 rounded-full border border-slate-800/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              <Image src="/icon.svg" alt="WorldPredict logo" width={24} height={24} />
              {t("header.brandName")}
            </p>
            <p className="text-xs text-slate-400">{t("header.tagline")}</p>
          </div>
          {user ? (
            <div className="min-w-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-right text-xs text-emerald-300">
              <p className="truncate font-medium text-emerald-200">{accountLabel}</p>
              <p className="truncate text-[11px] text-emerald-400/80">{currentUserProfile?.email ?? t("header.authenticatedLabel")}</p>
            </div>
          ) : (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {t("aside.readyWhenYouAre")}
            </span>
          )}
        </header>

        <section className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:py-16">
          <div className="space-y-7 lg:space-y-8">
            <div className="space-y-4 sm:space-y-5">
              <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                {activeTournament ? `${activeTournament.name} • ${activeTournament.year}` : t("eyebrow.activeTournament")}
              </p>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {t.rich("hero.title", { rivalry: (chunk) => <span className="text-cyan-300">{chunk}</span> })}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  {t("hero.subtitle")}
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
                  {t("cta.logOut")}
                </Link>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("stats.activeTournament")}</p>
                <p className="mt-2 text-2xl font-bold text-white">{activeTournament ? activeTournament.name : t("stats.offline")}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{activeTournament ? `Season ${activeTournament.year}` : t("stats.noTournamentData")}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("stats.globalLeader")}</p>
                <p className="mt-2 text-2xl font-bold text-white">{leader ? `#${leader.position} ${leader.username}` : t("stats.noRankingsYet")}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{leader ? t("stats.points", { count: leader.totalPoints }) : t("stats.beFirstToScore")}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("stats.rankedPlayers")}</p>
                <p className="mt-2 text-2xl font-bold text-white">{ranking.length}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{leader ? t("stats.exactPicks", { count: leader.exactPredictions }) : t("stats.waitingForScores")}</p>
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-[2rem] border border-slate-800/80 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-5">
            <div className="rounded-[1.5rem] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{t("aside.matchToWatch")}</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {previewMatch ? `${previewMatch.homeTeam.name} vs ${previewMatch.awayTeam.name}` : t("aside.noMatchesScheduled")}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  {previewMatch?.status ?? t("aside.noMatchesScheduled")}
                </div>
              </div>

              {previewMatch ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                  <p>{previewMatch.stage}</p>
                  <p className="mt-1 text-slate-400">{t("aside.kickoff", { date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(previewMatch.kickoffAt)) })}</p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                  {t("aside.noUpcomingMatches")}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {user ? t("aside.yourAccount") : t("aside.readyWhenYouAre")}
              </p>
              {user ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="font-semibold text-white">{accountLabel}</p>
                    <p className="text-sm text-slate-400">{currentUserProfile?.email ?? t("header.authenticatedLabel")}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={getLocalizedPath(locale as AppLocale, "/onboarding")}
                      className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-medium text-cyan-300"
                    >
                      {profileComplete ? t("cta.editProfile") : t("cta.completeProfile")}
                    </Link>
                    <Link href={getLocalizedPath(locale as AppLocale, "/groups")} className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200">
                      {t("cta.myGroups")}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-6 text-slate-400">
                    {t("aside.signInPrompt")}
                  </p>
                  <Link href="/auth/login" className="inline-flex text-sm font-medium text-cyan-300">
                    {t("aside.logIn")}
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}