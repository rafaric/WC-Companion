/**
 * Shared server-side helper for resolving the selected tournament slug from cookies.
 * Use this in all Server Components and Server Actions that need tournament context.
 *
 * This centralizes the cookie-reading + parsing logic so pages don't duplicate it
 * and can't accidentally call API helpers without forwarding the resolved slug.
 */

import { cookies } from "next/headers";

import { getTournamentSlugFromCookies, parseTournamentSlug } from "./tournament-context";

/**
 * Resolve the selected tournament slug from cookies in a server component context.
 * Returns the slug string if set, or null if the user has not made an explicit selection
 * (in which case the API falls back to ACTIVE behavior).
 *
 * Usage in a Server Component:
 *   const tournamentSlug = await resolveTournamentSlug();
 *   const ranking = await getGlobalRanking(tournamentSlug);
 *
 * Usage in a Server Action:
 *   const tournamentSlug = await resolveTournamentSlug();
 */
export async function resolveTournamentSlug(): Promise<string | null> {
  const cookieStore = await cookies();
  const rawSlug = getTournamentSlugFromCookies({ get: (name) => cookieStore.get(name) });
  return parseTournamentSlug(rawSlug);
}