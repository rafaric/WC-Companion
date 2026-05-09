import type { CurrentUserProfile, MatchView, TeamView } from "@/lib/api";

export const PROFILE_COUNTRY_OPTIONS = [
  { code: "AR", label: "Argentina" },
  { code: "UY", label: "Uruguay" },
  { code: "BR", label: "Brazil" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "DE", label: "Germany" },
  { code: "PT", label: "Portugal" },
  { code: "GB", label: "United Kingdom" },
] as const;

export type ProfileCountryCode = (typeof PROFILE_COUNTRY_OPTIONS)[number]["code"];

export const PROFILE_LANGUAGE_OPTIONS = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
] as const;

export type ProfileLanguage = (typeof PROFILE_LANGUAGE_OPTIONS)[number]["code"];

export function extractUniqueTeamsFromMatches(matches: MatchView[]): TeamView[] {
  const teamsById = new Map<string, TeamView>();

  for (const match of matches) {
    if (!teamsById.has(match.homeTeam.id)) {
      teamsById.set(match.homeTeam.id, match.homeTeam);
    }

    if (!teamsById.has(match.awayTeam.id)) {
      teamsById.set(match.awayTeam.id, match.awayTeam);
    }
  }

  return Array.from(teamsById.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function isProfileComplete(profile: CurrentUserProfile): boolean {
  return profile.country !== null && profile.favoriteTeamId !== null;
}

export function getTeamLabel(team: TeamView | null): string {
  if (!team) {
    return "Not set";
  }

  return team.shortName ? `${team.name} (${team.shortName})` : team.name;
}

export function formatCountryLabel(countryCode: string | null): string {
  if (!countryCode) {
    return "Not set";
  }

  const match = PROFILE_COUNTRY_OPTIONS.find((option) => option.code === countryCode);

  return match?.label ?? countryCode;
}
