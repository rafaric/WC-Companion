import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { auth0 } from "@/lib/auth0";
import {
  getActiveTournamentMatches,
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from "@/lib/api";
import { buildPageMetadata } from "@/lib/metadata";
import {
  extractUniqueTeamsFromMatches,
  PROFILE_COUNTRY_OPTIONS,
  PROFILE_LANGUAGE_OPTIONS,
} from "@/lib/profile";
import { getFriendlyDisplayName } from "@/lib/user-display";
import { getTournamentSlugFromCookies, parseTournamentSlug } from "@/lib/tournament-context";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getLocalizedPath, type AppLocale } from "@/lib/locale-nav";

type OnboardingSearchParams = {
  error?: string;
};

interface OnboardingPageProps {
  searchParams?: Promise<OnboardingSearchParams>;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<ReturnType<typeof buildPageMetadata>> {
  const { locale } = await params;
  const t = await getTranslations("metadata.onboarding");
  return buildPageMetadata({
    description: t("description"),
    index: false,
    locale,
    path: "/onboarding",
    title: t("title"),
  });
}

export default async function OnboardingPage({ searchParams, params }: OnboardingPageProps) {
  const { locale } = await params;
  const t = await getTranslations("onboarding");

  const session = await auth0.getSession();

  if (!session) {
    redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/onboarding")}`);
  }

  // Read tournament selection from cookie
  const cookieStore = await cookies();
  const selectedSlug = parseTournamentSlug(
    getTournamentSlugFromCookies({ get: (name) => cookieStore.get(name) })
  );
  const tournamentSlug = selectedSlug ?? null;

  const resolvedSearchParams = await searchParams;
  const matches = await getActiveTournamentMatches(tournamentSlug).catch(() => []);
  const teams = extractUniqueTeamsFromMatches(matches);
  const teamIds = teams.map((team) => team.id);
  const { token } = await auth0.getAccessToken();
  const currentUserProfile = await getCurrentUserProfile(token);

  async function submitProfile(formData: FormData) {
    "use server";

    const country = String(formData.get("country") ?? "");
    const favoriteTeamId = String(formData.get("favoriteTeamId") ?? "");
    const preferredLanguage = String(formData.get("preferredLanguage") ?? "");

    const countryIsValid = PROFILE_COUNTRY_OPTIONS.some((option) => option.code === country);
    const languageIsValid = PROFILE_LANGUAGE_OPTIONS.some((option) => option.code === preferredLanguage);
    const teamIsValid = teamIds.includes(favoriteTeamId);

    if (!countryIsValid || !languageIsValid || !teamIsValid) {
      redirect(getLocalizedPath(locale as AppLocale, `/onboarding?error=invalid_input`));
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/onboarding")}`);
    }

    try {
      await updateCurrentUserProfile(actionToken, {
        country,
        favoriteTeamId,
        preferredLanguage,
      });
    } catch {
      redirect(getLocalizedPath(locale as AppLocale, `/onboarding?error=update_failed`));
    }

    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/onboarding`);
    redirect(getLocalizedPath(locale as AppLocale, "/"));
  }

  return (
    <main id="main-content" tabIndex={-1} className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="worldpredict-aurora absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-full border border-slate-800/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">{t("header.brandName")}</p>
            <p className="text-xs text-slate-400">{t("header.completeProfile")}</p>
          </div>
          <Link
            href={getLocalizedPath(locale as AppLocale, "/")}
            className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
          >
            {t("header.backHome")}
          </Link>
        </header>

        <section className="flex flex-1 items-center py-10 lg:py-16">
          <div className="w-full rounded-[2rem] border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
            <div className="max-w-2xl space-y-3">
              <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
                {t("eyebrow.profileSetup")}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("title.finishYourAccountDetails")}</h1>
              <p className="text-sm leading-6 text-slate-300">
                {t("subtitle.personalizeCompetition")}
              </p>
              <p className="text-sm text-slate-400">{t("signedInAs", { name: getFriendlyDisplayName(session.user, currentUserProfile) })}</p>
            </div>

            {resolvedSearchParams?.error ? (
              <div role="alert" aria-live="assertive" className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {t(`errorMessages.${resolvedSearchParams.error}`)}
              </div>
            ) : null}

            <form action={submitProfile} className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">{t("form.country")}</span>
                <select
                  name="country"
                  defaultValue={currentUserProfile.country ?? ""}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                  required
                >
                  <option value="" disabled>
                    {t("form.selectCountry")}
                  </option>
                  {PROFILE_COUNTRY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-200">{t("form.preferredLanguage")}</span>
                <select
                  name="preferredLanguage"
                  defaultValue={currentUserProfile.preferredLanguage ?? "es"}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                  required
                >
                  {PROFILE_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-200">{t("form.favoriteTeam")}</span>
                <select
                  name="favoriteTeamId"
                  defaultValue={currentUserProfile.favoriteTeamId ?? ""}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
                  required
                  disabled={teams.length === 0}
                >
                  <option value="" disabled>
                    {teams.length === 0 ? t("form.noTeamsAvailable") : t("form.selectTeam")}
                  </option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.shortName ? `${team.name} (${team.shortName})` : team.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">
                  {teams.length === 0 ? t("form.waitingForMatches") : t("form.lastStepBeforePredicting")}
                </p>
                <button
                  type="submit"
                  className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={teams.length === 0}
                >
                  {t("form.saveProfile")}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
