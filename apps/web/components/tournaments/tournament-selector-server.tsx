/**
 * Server component wrapper that fetches initial data for the tournament selector.
 * This component runs on the server and provides the initial tournament list and selected slug.
 */

import { cookies } from "next/headers";
import { listTournaments } from "@/lib/api";
import { getTournamentSlugFromCookies, parseTournamentSlug } from "@/lib/tournament-context";
import { TournamentSelector } from "./tournament-selector";

interface TournamentSelectorServerProps {
  /** CSS class name for container */
  className?: string;
}

/**
 * Server component wrapper that provides tournament context to the client selector.
 * Fetches tournaments and current selection server-side for SSR/hydration.
 */
export async function TournamentSelectorServer({ className }: TournamentSelectorServerProps) {
  // Get initial tournament data server-side
  const [tournaments, cookieStore] = await Promise.all([
    listTournaments(),
    cookies(),
  ]);

  const currentSlug = parseTournamentSlug(
    getTournamentSlugFromCookies(cookieStore as { get: (name: string) => { value: string } | undefined })
  );

  return (
    <TournamentSelector
      initialSlug={currentSlug}
      initialTournaments={tournaments}
      className={className}
    />
  );
}