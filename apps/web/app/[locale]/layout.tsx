import { hasLocale, NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { auth0 } from "@/lib/auth0";
import { getActiveTournamentMatches, getCurrentUserProfile, type CurrentUserProfile, type TeamView } from "@/lib/api";
import { extractUniqueTeamsFromMatches } from "@/lib/profile";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import { AppChrome } from "./app-chrome";
import { TournamentSelectorServer } from "@/components/tournaments/tournament-selector-server";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

const MATCHES_FINALIZE_PERMISSION = "matches:finalize" as const;

function getUserPermissions(user: unknown): string[] {
  if (typeof user !== "object" || user === null || !("permissions" in user)) {
    return [];
  }

  const permissions = (user as { permissions?: unknown }).permissions;

  if (!Array.isArray(permissions) || permissions.some((permission) => typeof permission !== "string")) {
    return [];
  }

  return permissions;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Validate locale against routing config at the layout level
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  // Reconstruct shell data that old root layout provided to AppChrome
  const session = await auth0.getSession();
  let currentUserProfile: CurrentUserProfile | null = null;
  let availableTeams: TeamView[] = [];
  let favoriteTeam: TeamView | null = null;

  if (session) {
    try {
      const accessToken = (await auth0.getAccessToken()).token;
      currentUserProfile = await getCurrentUserProfile(accessToken).catch(() => null);

      // Derive availableTeams and favoriteTeam from active tournament matches
      const tournamentSlug = await resolveTournamentSlug();
      const matches = await getActiveTournamentMatches(tournamentSlug).catch(() => []);
      availableTeams = extractUniqueTeamsFromMatches(matches);

      if (currentUserProfile && currentUserProfile.favoriteTeamId) {
        const profileFavoriteTeamId = currentUserProfile.favoriteTeamId;
        favoriteTeam = availableTeams.find((team) => team.id === profileFavoriteTeamId) ?? null;
      }
    } catch {
      // Auth errors → render without authenticated chrome
    }
  }

  const canAccessExternalResults = session ? getUserPermissions(session.user).includes(MATCHES_FINALIZE_PERMISSION) : false;

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AppChrome
            availableTeams={availableTeams}
            canAccessExternalResults={canAccessExternalResults}
            currentUserProfile={currentUserProfile}
            favoriteTeam={favoriteTeam}
            sessionUser={session?.user ?? null}
            tournamentSelector={<TournamentSelectorServer />}
          >
            {children}
          </AppChrome>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}