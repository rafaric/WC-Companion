import "server-only";

const DEFAULT_API_BASE_URL = "http://localhost:3001";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export const TOURNAMENT_STATUS = {
  ACTIVE: "ACTIVE",
} as const;

export const MATCH_STATUS = {
  UPCOMING: "UPCOMING",
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
}

export interface UpsertMatchPredictionInput {
  homeScore: number;
  awayScore: number;
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

export async function getActiveTournament(): Promise<Tournament> {
  return fetchJson<Tournament>("/tournaments/active");
}

export async function getActiveTournamentMatches(): Promise<MatchView[]> {
  return fetchJson<MatchView[]>("/tournaments/active/matches");
}

export async function getGlobalRanking(): Promise<RankingEntry[]> {
  return fetchJson<RankingEntry[]>("/rankings/global");
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
  return fetchJson<CurrentUserProfile>("/users/me/profile", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function getMyGroups(accessToken: string): Promise<MyGroupView[]> {
  return fetchJson<MyGroupView[]>("/groups/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function createGroup(accessToken: string, input: CreateGroupInput): Promise<GroupView> {
  return fetchJson<GroupView>("/groups", {
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
