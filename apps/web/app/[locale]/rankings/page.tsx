import { getTranslations } from "next-intl/server";

import { auth0 } from "@/lib/auth0";
import {
  getCurrentUserProfile,
  getGlobalRanking,
  type CurrentUserProfile,
  type RankingEntry,
} from "@/lib/api";
import { buildPageMetadata } from "@/lib/metadata";
import { getFriendlyDisplayName } from "@/lib/user-display";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import { RankingList } from "./ranking-list";

const VISIBLE_RANKING_LIMIT = 10;

interface RankingsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: RankingsPageProps): Promise<ReturnType<typeof buildPageMetadata>> {
  const { locale } = await params;
  const t = await getTranslations("metadata.rankings");

  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    index: false,
    locale,
    path: "/rankings",
  });
}

export default async function RankingsPage() {
  const t = await getTranslations("rankings");
  const session = await auth0.getSession();
  const tournamentSlug = await resolveTournamentSlug();
  const rankingPromise = getGlobalRanking(tournamentSlug).catch(() => [] as RankingEntry[]);

  let currentUserProfile: CurrentUserProfile | null = null;

  if (session) {
    try {
      const { token } = await auth0.getAccessToken();
      currentUserProfile = await getCurrentUserProfile(token);
    } catch {
      currentUserProfile = null;
    }
  }

  const ranking = await rankingPromise;
  const currentUserRankingEntry = currentUserProfile
    ? ranking.find((entry) => entry.userId === currentUserProfile.id) ?? null
    : null;
  const displayName = session ? getFriendlyDisplayName(session.user, currentUserProfile) : t("you");

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl">
      <section className="space-y-6 py-2 sm:py-4">
        <div className="space-y-3">
          <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
            {t("eyebrow")}
          </p>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("title")}</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{t("description")}</p>
        </div>

        {currentUserRankingEntry ? (
          <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-slate-900/80 to-violet-400/10 p-4 shadow-xl shadow-cyan-950/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/30 bg-slate-950/70 shadow-lg shadow-cyan-500/10">
                  <span className="text-2xl font-black text-cyan-200">#{currentUserRankingEntry.position}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{t("yourStanding")}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{displayName}</p>
                  <p className="text-xs text-cyan-100/70">{t("yourPlace")}</p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{t("points")}</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-white">{currentUserRankingEntry.totalPoints}</p>
                <p className="text-xs font-semibold text-cyan-100/70">{t("pts")}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("exactPicks")}</p>
                <p className="mt-1 text-xl font-black text-white">{currentUserRankingEntry.exactPredictions}</p>
              </div>
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-center">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("predictions")}</p>
                <p className="mt-1 text-xl font-black text-white">{currentUserRankingEntry.predictionsCount}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("ranking")}</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{t("topPositions")}</h2>
              <p className="mt-1 text-sm text-slate-400">
                {t("showingTop", { visible: Math.min(VISIBLE_RANKING_LIMIT, ranking.length) })}
              </p>
            </div>
            <p className="text-sm text-slate-400">{t("players", { count: ranking.length })}</p>
          </div>

          {ranking.length > 0 ? (
            <RankingList
              currentUserDisplayName={displayName}
              currentUserId={currentUserProfile?.id ?? null}
              currentUserRankingEntry={currentUserRankingEntry}
              ranking={ranking}
            />
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
              {t("noGlobalData")}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
