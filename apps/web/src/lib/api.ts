import "server-only";

import { cookies } from "next/headers";
import { getTournamentSlugFromCookies, parseTournamentSlug, TOURNAMENT_COOKIE_NAME } from "./tournament-context";

const DEFAULT_API_BASE_URL = "http://localhost:3001";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

/**
 * Get the currently selected tournament slug from cookies.
 * Used by server components to forward tournament context to API calls.
 *
 * @returns The selected tournament slug or null if not set
 */
export async function getSelectedTournamentSlug(): Promise<string | null> {
  const cookieStore = await cookies();
  const slug = getTournamentSlugFromCookies({ get: (name) => cookieStore.get(name) });
  return parseTournamentSlug(slug);
}

/**
 * Get the tournament slug from a cookie store directly.
 * Useful when you already have a cookie store instance.
 *
 * @param cookieStore - Cookie store with get method
 * @returns The selected tournament slug or null if not set
 */
export function getTournamentSlugFromCookieStore(
  cookieStore: { get: (name: string) => { value: string } | undefined }
): string | null {
  const slug = getTournamentSlugFromCookies(cookieStore);
  return parseTournamentSlug(slug);
}

/**
 * Cookie store interface compatible with Next.js cookies() API.
 */
export interface CookieStore {
  get(name: string): { value: string } | undefined;
}

export const TOURNAMENT_STATUS = {
  ACTIVE: "ACTIVE",
} as const;

export const MATCH_STATUS = {
  FINISHED: "FINISHED",
  UPCOMING: "UPCOMING",
} as const;

export const PREDICTION_SCORING_STATUS = {
  PENDING: "PENDING",
  SCORED: "SCORED",
} as const;

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  year: number;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
}

export interface TeamColors {
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface TeamView {
  id: string;
  name: string;
  shortName: string;
  countryCode: string | null;
  flagCode: string | null;
  colors: TeamColors;
  crestUrl: string | null;
}

export interface MatchView {
  id: string;
  tournamentId: string;
  stage: string;
  groupName: string;
  kickoffAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  finalizedAt: string | null;
  homeTeam: TeamView;
  awayTeam: TeamView;
}

export const EXTERNAL_MATCH_RESULT_STATES = {
  PENDING_CONFIRMATION: "PENDING_CONFIRMATION",
  CONFIRMED: "CONFIRMED",
  DISCARDED: "DISCARDED",
} as const;

export type ExternalMatchResultState = (typeof EXTERNAL_MATCH_RESULT_STATES)[keyof typeof EXTERNAL_MATCH_RESULT_STATES];

export interface ExternalMatchResultMatchView {
  matchId: string;
  status: string;
  kickoffAt: string;
  homeTeamName: string;
  awayTeamName: string;
  stage: string | null;
  groupName: string | null;
}

export interface ExternalMatchResultView {
  id: string;
  providerKey: string;
  externalMatchId: string;
  matchId: string | null;
  state: ExternalMatchResultState;
  homeScore: number;
  awayScore: number;
  playedAt: string | null;
  stagedAt: string;
  confirmedAt: string | null;
  discardedAt: string | null;
  match: ExternalMatchResultMatchView | null;
}

export interface ExternalMatchMappingDiagnosticResultView {
  externalMatchId: string;
  state: ExternalMatchResultState;
  homeScore: number;
  awayScore: number;
  stagedAt: string;
  confirmedAt: string | null;
  discardedAt: string | null;
}

export interface ExternalMatchMappingDiagnosticView {
  matchId: string;
  status: string;
  kickoffAt: string;
  homeTeamName: string;
  awayTeamName: string;
  stage: string | null;
  groupName: string | null;
  externalMatchId: string | null;
  hasExternalReference: boolean;
  latestExternalResult: ExternalMatchMappingDiagnosticResultView | null;
}

export interface ExternalSyncRunView {
  syncRunId: string;
  providerKey: string;
  tournamentId: string;
  syncType: string;
  status: string;
  importedCount: number;
  updatedCount: number;
  stagedCount: number;
  skippedCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ConfirmExternalMatchResultSummary {
  externalMatchResultId: string;
  externalMatchId: string;
  matchId: string;
  tournamentId: string;
  state: ExternalMatchResultState;
  confirmedAt: string;
}

export interface DiscardExternalMatchResultSummary {
  externalMatchResultId: string;
  externalMatchId: string;
  matchId: string | null;
  tournamentId: string;
  state: ExternalMatchResultState;
  discardedAt: string;
}

export interface PredictionView {
  id: string;
  matchId: string;
  tournamentId: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number;
  scoringStatus: string;
  submittedAt: string;
  updatedAt: string;
  scoredAt: string | null;
}

export interface RankingEntry {
  position: number;
  userId: string;
  username: string;
  avatar: string | null;
  country: string | null;
  favoriteTeamId: string | null;
  totalPoints: number;
  exactPredictions: number;
  predictionsCount: number;
  lastScoredAt: string | null;
  updatedAt: string;
}

export const GROUP_ROLE = {
  OWNER: "OWNER",
  MEMBER: "MEMBER",
} as const;

export type GroupRole = (typeof GROUP_ROLE)[keyof typeof GROUP_ROLE];

export interface GroupView {
  id: string;
  name: string;
  inviteCode: string;
  tournamentId: string;
  createdAt: string;
  memberCount: number;
}

export interface MyGroupView extends GroupView {
  role: GroupRole;
}

export interface CreateGroupInput {
  name: string;
}

export interface JoinGroupInput {
  inviteCode: string;
}

export interface CurrentUserProfile {
  id: string;
  email: string;
  username: string;
  country: string | null;
  favoriteTeamId: string | null;
  avatar: string | null;
  preferredLanguage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCurrentUserProfileInput {
  country: string;
  favoriteTeamId: string;
  preferredLanguage: string;
  tournamentSlug?: string | null;
}

export interface UpsertMatchPredictionInput {
  homeScore: number;
  awayScore: number;
}

export const SHARE_CARD_TYPE = {
  PREDICTION: "PREDICTION",
  PERFORMANCE_SUMMARY: "PERFORMANCE_SUMMARY",
  GROUP_RANKING: "GROUP_RANKING",
} as const;

type ShareCardType = (typeof SHARE_CARD_TYPE)[keyof typeof SHARE_CARD_TYPE];

export interface ShareCardPayloadBase {
  cardType: ShareCardType;
  tournamentName: string;
  tournamentYear: number;
  username: string;
  country: string | null;
  avatar: string | null;
  position: number;
  totalPoints: number;
  exactPredictions: number;
  predictionsCount: number;
  generatedAt: string;
}

export interface PerformanceSummaryShareCardPayload extends ShareCardPayloadBase {
  cardType: typeof SHARE_CARD_TYPE.PERFORMANCE_SUMMARY;
}

export interface GroupRankingShareCardPayload extends ShareCardPayloadBase {
  cardType: typeof SHARE_CARD_TYPE.GROUP_RANKING;
  groupName: string;
}

export interface PredictionShareCardPayload {
  cardType: typeof SHARE_CARD_TYPE.PREDICTION;
  tournamentName: string;
  tournamentYear: number;
  username: string;
  country: string | null;
  avatar: string | null;
  matchId: string;
  predictionId: string;
  homeTeamName: string;
  homeTeamShortName: string;
  homeTeamCountryCode: string | null;
  awayTeamName: string;
  awayTeamShortName: string;
  awayTeamCountryCode: string | null;
  predictedHomeScore: number;
  predictedAwayScore: number;
  pointsAwarded: number;
  scoringStatus: string;
  stage: string | null;
  groupName: string | null;
  kickoffAt: string;
  predictionUpdatedAt: string;
  generatedAt: string;
}

export type ShareCardPayloadSnapshot =
  | PerformanceSummaryShareCardPayload
  | GroupRankingShareCardPayload
  | PredictionShareCardPayload;

export interface ShareCardView {
  id: string;
  type: ShareCardType;
  imageUrl: string | null;
  payload: ShareCardPayloadSnapshot;
  createdAt: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly responseBody: string;

  constructor(message: string, status: number, url: string, responseBody: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.responseBody = responseBody;
  }
}

function buildApiUrl(path: string): URL {
  return new URL(path, API_BASE_URL);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path);
  const response = await fetch(url, {
    cache: init?.cache ?? "no-store",
    ...init,
  });

  if (!response.ok) {
    const responseBody = await response.text();
    const message = responseBody
      ? `Failed to fetch ${url.pathname}: ${response.status} ${response.statusText} — ${responseBody}`
      : `Failed to fetch ${url.pathname}: ${response.status} ${response.statusText}`;

    throw new ApiError(message, response.status, url.toString(), responseBody);
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse ${url.pathname} response as JSON: ${detail}`);
  }
}

/**
 * Fetch tournaments list for selector UI.
 * Returns all tournaments ordered by status and year.
 */
export async function listTournaments(): Promise<Tournament[]> {
  return fetchJson<Tournament[]>("/tournaments");
}

export async function getActiveTournament(tournamentSlug?: string | null): Promise<Tournament> {
  const url = tournamentSlug
    ? `/tournaments/active?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : "/tournaments/active";
  return fetchJson<Tournament>(url);
}

export async function getActiveTournamentMatches(tournamentSlug?: string | null): Promise<MatchView[]> {
  const url = tournamentSlug
    ? `/tournaments/active/matches?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : "/tournaments/active/matches";
  return fetchJson<MatchView[]>(url);
}

export async function getGlobalRanking(tournamentSlug?: string | null): Promise<RankingEntry[]> {
  // Backend route is /rankings/global - always hit the global endpoint and forward selector context via query param
  const url = tournamentSlug
    ? `/rankings/global?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : "/rankings/global";
  return fetchJson<RankingEntry[]>(url);
}

/**
 * Get ranking entries for a specific tournament.
 * Now forwards tournamentSlug to getGlobalRanking which supports selector-aware context.
 *
 * @param tournamentSlug - The tournament slug to filter rankings by
 * @returns Ranking entries for the tournament
 */
export async function getTournamentRanking(tournamentSlug: string): Promise<RankingEntry[]> {
  return getGlobalRanking(tournamentSlug);
}

export async function getCurrentUserProfile(accessToken: string): Promise<CurrentUserProfile> {
  return fetchJson<CurrentUserProfile>("/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getMyPredictions(accessToken: string): Promise<PredictionView[]> {
  return fetchJson<PredictionView[]>("/predictions/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function upsertMatchPrediction(
  accessToken: string,
  matchId: string,
  input: UpsertMatchPredictionInput,
): Promise<PredictionView> {
  return fetchJson<PredictionView>(`/predictions/matches/${matchId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function updateCurrentUserProfile(
  accessToken: string,
  input: UpdateCurrentUserProfileInput,
): Promise<CurrentUserProfile> {
  const url = input.tournamentSlug
    ? `/users/me/profile?tournamentSlug=${encodeURIComponent(input.tournamentSlug)}`
    : "/users/me/profile";

  return fetchJson<CurrentUserProfile>(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      country: input.country,
      favoriteTeamId: input.favoriteTeamId,
      preferredLanguage: input.preferredLanguage,
    }),
  });
}

export async function getMyGroups(accessToken: string, tournamentSlug?: string | null): Promise<MyGroupView[]> {
  const url = tournamentSlug
    ? `/groups/me?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : "/groups/me";
  return fetchJson<MyGroupView[]>(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function createGroup(accessToken: string, input: CreateGroupInput, tournamentSlug?: string | null): Promise<GroupView> {
  const url = tournamentSlug
    ? `/groups?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : "/groups";
  return fetchJson<GroupView>(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function joinGroup(accessToken: string, input: JoinGroupInput): Promise<GroupView> {
  return fetchJson<GroupView>("/groups/join", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function getGroupRanking(accessToken: string, groupId: string): Promise<RankingEntry[]> {
  return fetchJson<RankingEntry[]>(`/groups/${groupId}/ranking`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function createMyPerformanceSummaryShareCard(
  accessToken: string,
  tournamentSlug?: string | null
): Promise<ShareCardView> {
  const url = tournamentSlug
    ? `/share-cards/me/global-ranking?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : "/share-cards/me/global-ranking";
  return fetchJson<ShareCardView>(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function createGroupRankingShareCard(
  accessToken: string,
  groupId: string,
  tournamentSlug?: string | null
): Promise<ShareCardView> {
  const url = tournamentSlug
    ? `/share-cards/groups/${groupId}/ranking?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : `/share-cards/groups/${groupId}/ranking`;
  return fetchJson<ShareCardView>(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function createPredictionShareCard(
  accessToken: string,
  matchId: string,
  tournamentSlug?: string | null
): Promise<ShareCardView> {
  const url = tournamentSlug
    ? `/share-cards/predictions/matches/${matchId}?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : `/share-cards/predictions/matches/${matchId}`;
  return fetchJson<ShareCardView>(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getExternalMatchResults(
  accessToken: string,
  state: ExternalMatchResultState = EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION,
  tournamentSlug?: string | null,
): Promise<ExternalMatchResultView[]> {
  const url = tournamentSlug
    ? `/admin/sports-data/external-results?state=${state}&tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : `/admin/sports-data/external-results?state=${state}`;
  return fetchJson<ExternalMatchResultView[]>(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getPendingExternalMatchResults(accessToken: string): Promise<ExternalMatchResultView[]> {
  return getExternalMatchResults(accessToken, EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION);
}

export async function getExternalMatchMappingDiagnostics(
  accessToken: string,
  tournamentSlug?: string | null,
): Promise<ExternalMatchMappingDiagnosticView[]> {
  const url = tournamentSlug
    ? `/admin/sports-data/external-results/diagnostics/matches?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : "/admin/sports-data/external-results/diagnostics/matches";
  return fetchJson<ExternalMatchMappingDiagnosticView[]>(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getExternalSyncRuns(
  accessToken: string,
  tournamentSlug?: string | null,
): Promise<ExternalSyncRunView[]> {
  const url = tournamentSlug
    ? `/admin/sports-data/external-results/sync-runs?tournamentSlug=${encodeURIComponent(tournamentSlug)}`
    : "/admin/sports-data/external-results/sync-runs";
  return fetchJson<ExternalSyncRunView[]>(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function confirmExternalMatchResult(
  accessToken: string,
  externalMatchResultId: string,
): Promise<ConfirmExternalMatchResultSummary> {
  return fetchJson<ConfirmExternalMatchResultSummary>(
    `/admin/sports-data/external-results/${externalMatchResultId}/confirm`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export async function discardExternalMatchResult(
  accessToken: string,
  externalMatchResultId: string,
): Promise<DiscardExternalMatchResultSummary> {
  return fetchJson<DiscardExternalMatchResultSummary>(
    `/admin/sports-data/external-results/${externalMatchResultId}/discard`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export interface SportsDataSyncSummary {
  syncRunId: string;
  providerKey: string;
  tournamentId: string;
  syncType: string;
  status: string;
  importedCount: number;
  updatedCount: number;
  stagedCount: number;
  skippedCount: number;
  errorMessage: string | null;
}

export async function importTournament(accessToken: string, tournamentId?: string): Promise<SportsDataSyncSummary> {
  return fetchJson<SportsDataSyncSummary>("/admin/sports-data/external-results/sync/import", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tournamentId }),
  });
}

export async function syncResults(accessToken: string, tournamentId?: string): Promise<SportsDataSyncSummary> {
  return fetchJson<SportsDataSyncSummary>("/admin/sports-data/external-results/sync/results", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tournamentId }),
  });
}
