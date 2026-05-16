"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import { ApiError, getActiveTournamentMatches, updateCurrentUserProfile } from "@/lib/api";
import { extractUniqueTeamsFromMatches, PROFILE_COUNTRY_OPTIONS, PROFILE_LANGUAGE_OPTIONS } from "@/lib/profile";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import { getLocalizedPath, type AppLocale } from "@/lib/locale-nav";

interface ProfileUpdateError {
  error: string;
}

function getProfileUpdateErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.responseBody) {
      return error.responseBody;
    }
  }

  return "We could not save your profile. Please try again.";
}

export async function updateProfile(
  prevState: ProfileUpdateError | undefined,
  formData: FormData,
  locale: AppLocale,
): Promise<ProfileUpdateError | undefined> {
  void prevState;

  const country = String(formData.get("country") ?? "");
  const favoriteTeamId = String(formData.get("favoriteTeamId") ?? "");
  const preferredLanguage = String(formData.get("preferredLanguage") ?? "");
  const tournamentSlug = await resolveTournamentSlug();
  const matches = await getActiveTournamentMatches(tournamentSlug).catch(() => []);
  const teamIds = extractUniqueTeamsFromMatches(matches).map((team) => team.id);

  const countryIsValid = PROFILE_COUNTRY_OPTIONS.some((option) => option.code === country);
  const languageIsValid = PROFILE_LANGUAGE_OPTIONS.some((option) => option.code === preferredLanguage);
  const favoriteTeamIsValid = teamIds.includes(favoriteTeamId);

  if (!countryIsValid || !languageIsValid || !favoriteTeamIsValid) {
    return { error: "Choose a valid favorite team for the current tournament." };
  }

  try {
    const { token } = await auth0.getAccessToken();

    await updateCurrentUserProfile(token, {
      country,
      favoriteTeamId,
      preferredLanguage,
      tournamentSlug,
    });
    revalidatePath(getLocalizedPath(locale, "/"));
    revalidatePath(getLocalizedPath(locale, "/dashboard"));
    revalidatePath(getLocalizedPath(locale, "/onboarding"));
    return undefined;
  } catch (error) {
    return { error: getProfileUpdateErrorMessage(error) };
  }
}

export async function updateProfileAndRedirect(formData: FormData, redirectTo: string, locale: AppLocale) {
  const country = String(formData.get("country") ?? "");
  const favoriteTeamId = String(formData.get("favoriteTeamId") ?? "");
  const preferredLanguage = String(formData.get("preferredLanguage") ?? "");
  const tournamentSlug = await resolveTournamentSlug();
  const matches = await getActiveTournamentMatches(tournamentSlug).catch(() => []);
  const teamIds = extractUniqueTeamsFromMatches(matches).map((team) => team.id);

  const countryIsValid = PROFILE_COUNTRY_OPTIONS.some((option) => option.code === country);
  const languageIsValid = PROFILE_LANGUAGE_OPTIONS.some((option) => option.code === preferredLanguage);
  const favoriteTeamIsValid = teamIds.includes(favoriteTeamId);

  if (!countryIsValid || !languageIsValid || !favoriteTeamIsValid) {
    redirect(getLocalizedPath(locale, `/onboarding?error=invalid_input`));
  }

  try {
    const { token } = await auth0.getAccessToken();

    await updateCurrentUserProfile(token, {
      country,
      favoriteTeamId,
      preferredLanguage,
      tournamentSlug,
    });
  } catch {
    redirect(getLocalizedPath(locale, "/onboarding?error=update_failed"));
  }

  revalidatePath(getLocalizedPath(locale, "/"));
  revalidatePath(getLocalizedPath(locale, "/onboarding"));
  redirect(redirectTo);
}