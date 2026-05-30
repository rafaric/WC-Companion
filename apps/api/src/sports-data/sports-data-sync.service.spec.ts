import { MatchStatus, TournamentStatus } from "@prisma/client";

import type {
	MatchesService,
	FinalizeMatchSummary,
} from "../matches/matches.service";
import type { PrismaService } from "../prisma/prisma.service";
import type {
	TournamentsService,
	TournamentContextInput,
} from "../tournaments/tournaments.service";
import {
	MOCK_SPORTS_DATA_PROVIDER_SNAPSHOT,
	MockSportsDataProvider,
} from "./mock-sports-data.provider";
import { SportsDataProviderFactory } from "./sports-data-provider.factory";
import { SportsDataSyncService } from "./sports-data-sync.service";
import type { SportsDataFinalResultDTO } from "./sports-data.types";

interface TournamentRecord {
	id: string;
	slug: string;
	status: TournamentStatus;
	providerKey: string | null;
}

interface TeamRecord {
	id: string;
	tournamentId: string;
	name: string;
	shortName: string;
	countryCode: string | null;
	flagCode: string | null;
	primaryColor: string | null;
	secondaryColor: string | null;
}

interface VenueRecord {
	id: string;
	tournamentId: string;
	name: string;
	city: string | null;
	countryCode: string | null;
	capacity: number | null;
}

interface MatchRecord {
	id: string;
	tournamentId: string;
	homeTeamId: string;
	awayTeamId: string;
	venueId: string | null;
	kickoffAt: Date;
	stage: string | null;
	groupName: string | null;
	status: MatchStatus;
}

interface ExternalTeamReferenceRecord {
	providerKey: string;
	tournamentId: string;
	externalId: string;
	teamId: string;
}

interface ExternalVenueReferenceRecord {
	providerKey: string;
	tournamentId: string;
	externalId: string;
	venueId: string;
}

interface ExternalMatchReferenceRecord {
	providerKey: string;
	tournamentId: string;
	externalId: string;
	matchId: string;
}

interface ExternalMatchResultRecord {
	id: string;
	providerKey: string;
	tournamentId: string;
	externalMatchId: string;
	matchId: string | null;
	externalSyncRunId: string | null;
	homeScore: number;
	awayScore: number;
	playedAt: Date | null;
	state: "PENDING_CONFIRMATION" | "CONFIRMED" | "DISCARDED";
	stagedAt?: Date;
	confirmedAt: Date | null;
	discardedAt: Date | null;
}

interface ExternalMatchResultMatchRecord {
	id: string;
	status: MatchStatus;
	kickoffAt: Date;
	stage: string | null;
	groupName: string | null;
	homeTeam: {
		name: string;
	};
	awayTeam: {
		name: string;
	};
}

interface ExternalMatchResultListRecord extends ExternalMatchResultRecord {
	match: ExternalMatchResultMatchRecord | null;
}

interface SyncRunRecord {
	id: string;
	providerKey: string;
	tournamentId: string;
	syncType: "IMPORT" | "RESULTS";
	status: "RUNNING" | "SUCCESS" | "FAILED";
	importedCount: number;
	updatedCount: number;
	stagedCount: number;
	skippedCount: number;
	errorMessage: string | null;
	startedAt: Date;
	completedAt: Date | null;
}

interface PrismaState {
	tournaments: TournamentRecord[];
	teams: TeamRecord[];
	venues: VenueRecord[];
	matches: MatchRecord[];
	externalTeamReferences: ExternalTeamReferenceRecord[];
	externalVenueReferences: ExternalVenueReferenceRecord[];
	externalMatchReferences: ExternalMatchReferenceRecord[];
	externalMatchResults: ExternalMatchResultRecord[];
	syncRuns: SyncRunRecord[];
}

interface PrismaMock {
	tournament: {
		findUnique: jest.Mock<Promise<TournamentRecord | null>, [unknown]>;
		findFirst: jest.Mock<Promise<TournamentRecord | null>, [unknown]>;
	};
	team: {
		findUnique: jest.Mock<Promise<TeamRecord | null>, [unknown]>;
		create: jest.Mock<Promise<Pick<TeamRecord, "id">>, [unknown]>;
		update: jest.Mock<Promise<TeamRecord>, [unknown]>;
	};
	venue: {
		findUnique: jest.Mock<Promise<VenueRecord | null>, [unknown]>;
		create: jest.Mock<Promise<Pick<VenueRecord, "id">>, [unknown]>;
		update: jest.Mock<Promise<VenueRecord>, [unknown]>;
	};
	match: {
		findUnique: jest.Mock<Promise<MatchRecord | null>, [unknown]>;
		findFirst: jest.Mock<Promise<MatchRecord | null>, [unknown]>;
		findMany: jest.Mock<Promise<unknown[]>, [unknown]>;
		create: jest.Mock<Promise<Pick<MatchRecord, "id">>, [unknown]>;
		update: jest.Mock<Promise<MatchRecord>, [unknown]>;
	};
	externalTeamReference: {
		findFirst: jest.Mock<
			Promise<ExternalTeamReferenceRecord | null>,
			[unknown]
		>;
		upsert: jest.Mock<Promise<ExternalTeamReferenceRecord>, [unknown]>;
		create: jest.Mock<Promise<ExternalTeamReferenceRecord>, [unknown]>;
	};
	externalVenueReference: {
		findFirst: jest.Mock<
			Promise<ExternalVenueReferenceRecord | null>,
			[unknown]
		>;
		create: jest.Mock<Promise<ExternalVenueReferenceRecord>, [unknown]>;
		update: jest.Mock<Promise<ExternalVenueReferenceRecord>, [unknown]>;
	};
	externalMatchReference: {
		findFirst: jest.Mock<
			Promise<ExternalMatchReferenceRecord | null>,
			[unknown]
		>;
		create: jest.Mock<Promise<ExternalMatchReferenceRecord>, [unknown]>;
		update: jest.Mock<Promise<ExternalMatchReferenceRecord>, [unknown]>;
	};
	externalSyncRun: {
		create: jest.Mock<Promise<SyncRunRecord>, [unknown]>;
		findMany: jest.Mock<Promise<SyncRunRecord[]>, [unknown]>;
		update: jest.Mock<Promise<SyncRunRecord>, [unknown]>;
	};
	externalMatchResult: {
		findUnique: jest.Mock<Promise<ExternalMatchResultRecord | null>, [unknown]>;
		findMany: jest.Mock<Promise<ExternalMatchResultListRecord[]>, [unknown]>;
		upsert: jest.Mock<Promise<ExternalMatchResultRecord>, [unknown]>;
		update: jest.Mock<Promise<ExternalMatchResultRecord>, [unknown]>;
	};
}

interface MatchesServiceMock {
	finalizeMatch: jest.Mock<Promise<FinalizeMatchSummary>, [unknown]>;
}

function createInitialState(overrides: Partial<PrismaState> = {}): PrismaState {
	return {
		tournaments: [
			{
				id: "tournament-1",
				slug: "world-cup-2026-demo",
				status: TournamentStatus.ACTIVE,
				providerKey: "mock",
			},
		],
		teams: [],
		venues: [],
		matches: [],
		externalTeamReferences: [],
		externalVenueReferences: [],
		externalMatchReferences: [],
		externalMatchResults: [],
		syncRuns: [],
		...overrides,
	};
}

function createProvider(
	finalResults: readonly SportsDataFinalResultDTO[] = [],
): MockSportsDataProvider {
	return new MockSportsDataProvider({
		...MOCK_SPORTS_DATA_PROVIDER_SNAPSHOT,
		finalResults,
	});
}

function createMatchesServiceMock(
	summary: FinalizeMatchSummary,
): MatchesServiceMock {
	return {
		finalizeMatch: jest.fn(async (_input: unknown) => summary),
	};
}

function createMockFactory(
	provider: MockSportsDataProvider,
	tournamentProviderKey:
		| "mock"
		| "football-data"
		| "api-sports"
		| "lpf-web" = "mock",
): SportsDataProviderFactory {
	return {
		getProvider: jest.fn((_key?: string | null) => provider),
		getAvailableProviders: jest.fn(
			(): Array<"mock" | "football-data" | "api-sports" | "lpf-web"> => [
				tournamentProviderKey,
			],
		),
		getDefaultProviderKey: jest.fn(
			(): "mock" | "football-data" | "api-sports" | "lpf-web" =>
				tournamentProviderKey,
		),
	} as unknown as SportsDataProviderFactory;
}

/**
 * Mock TournamentsService for backward compatibility with existing tests.
 * Provides ACTIVE tournament resolution.
 */
function createTournamentsServiceMock(overrides?: {
	id?: string;
	slug?: string;
	providerKey?: string;
}): TournamentsService {
	const tournamentId = overrides?.id ?? "tournament-1";
	const tournamentSlug = overrides?.slug ?? "world-cup-2026";
	const tournamentProviderKey = overrides?.providerKey ?? "mock";
	return {
		listTournaments: jest.fn(),
		resolveTournamentContext: jest.fn(async (input: TournamentContextInput) => {
			// If explicit tournament ID is provided, use it
			if (input?.explicitTournamentId) {
				return {
					tournament: {
						id: input.explicitTournamentId,
						name: "Test Tournament",
						slug: tournamentSlug,
						year: 2026,
						status: TournamentStatus.ACTIVE,
						startsAt: new Date("2026-06-11"),
						endsAt: new Date("2026-07-19"),
						providerKey: tournamentProviderKey,
					},
					source: "explicit" as const,
				};
			}
			// Default to ACTIVE tournament
			return {
				tournament: {
					id: tournamentId,
					name: "World Cup 2026",
					slug: tournamentSlug,
					year: 2026,
					status: TournamentStatus.ACTIVE,
					startsAt: new Date("2026-06-11"),
					endsAt: new Date("2026-07-19"),
					providerKey: tournamentProviderKey,
				},
				source: "active" as const,
			};
		}),
		getStrictActiveTournament: jest.fn(async () => ({
			id: "tournament-1",
			name: "World Cup 2026",
			slug: "world-cup-2026",
			year: 2026,
			status: TournamentStatus.ACTIVE,
			startsAt: new Date("2026-06-11"),
			endsAt: new Date("2026-07-19"),
			providerKey: tournamentProviderKey,
		})),
		getActiveTournament: jest.fn(async () => ({
			id: "tournament-1",
			name: "World Cup 2026",
			slug: "world-cup-2026",
			year: 2026,
			status: TournamentStatus.ACTIVE,
			startsAt: new Date("2026-06-11"),
			endsAt: new Date("2026-07-19"),
		})),
		getActiveTournamentMatches: jest.fn(),
		getTournamentMatches: jest.fn(),
	} as unknown as TournamentsService;
}

function createFinalizeMatchSummary(
	matchId: string,
	tournamentId: string,
): FinalizeMatchSummary {
	return {
		matchId,
		tournamentId,
		scoringSummary: {
			matchId,
			tournamentId,
			scoringRuleId: "rule-1",
			pendingCount: 2,
			processedCount: 2,
			alreadyScoredCount: 0,
			scoredAt: new Date("2026-05-08T12:00:00.000Z"),
		},
		globalRankingSummary: {
			scope: "GLOBAL",
			scopeId: "global",
			tournamentId,
			processedCount: 4,
		},
		groupRankingSummaries: [],
	};
}

function createPrismaMock(state: PrismaState): PrismaMock {
	return {
		tournament: {
			findUnique: jest.fn(
				async ({ where }: { where: { id: string } }) =>
					state.tournaments.find((tournament) => tournament.id === where.id) ??
					null,
			),
			findFirst: jest.fn(
				async ({ where }: { where: { status: TournamentStatus } }) =>
					state.tournaments.find(
						(tournament) => tournament.status === where.status,
					) ?? null,
			),
		},
		team: {
			findUnique: jest.fn(
				async ({
					where,
				}: {
					where: { tournamentId_name: { tournamentId: string; name: string } };
				}) =>
					state.teams.find(
						(team) =>
							team.tournamentId === where.tournamentId_name.tournamentId &&
							team.name === where.tournamentId_name.name,
					) ?? null,
			),
			create: jest.fn(async ({ data }: { data: Omit<TeamRecord, "id"> }) => {
				const record: TeamRecord = {
					id: `team-${state.teams.length + 1}`,
					...data,
				};
				state.teams.push(record);
				return { id: record.id };
			}),
			update: jest.fn(
				async ({
					where,
					data,
				}: {
					where: { id: string };
					data: Partial<Omit<TeamRecord, "id">>;
				}) => {
					const team = state.teams.find(
						(candidate) => candidate.id === where.id,
					);

					if (team === undefined) {
						throw new Error(`Missing team ${where.id}`);
					}

					Object.assign(team, data);
					return team;
				},
			),
		},
		venue: {
			findUnique: jest.fn(
				async ({
					where,
				}: {
					where: { tournamentId_name: { tournamentId: string; name: string } };
				}) =>
					state.venues.find(
						(venue) =>
							venue.tournamentId === where.tournamentId_name.tournamentId &&
							venue.name === where.tournamentId_name.name,
					) ?? null,
			),
			create: jest.fn(async ({ data }: { data: Omit<VenueRecord, "id"> }) => {
				const record: VenueRecord = {
					id: `venue-${state.venues.length + 1}`,
					...data,
				};
				state.venues.push(record);
				return { id: record.id };
			}),
			update: jest.fn(
				async ({
					where,
					data,
				}: {
					where: { id: string };
					data: Partial<Omit<VenueRecord, "id">>;
				}) => {
					const venue = state.venues.find(
						(candidate) => candidate.id === where.id,
					);

					if (venue === undefined) {
						throw new Error(`Missing venue ${where.id}`);
					}

					Object.assign(venue, data);
					return venue;
				},
			),
		},
		match: {
			findUnique: jest.fn(
				async ({ where }: { where: { id: string } }) =>
					state.matches.find((match) => match.id === where.id) ?? null,
			),
			findFirst: jest.fn(
				async ({
					where,
				}: {
					where: {
						tournamentId: string;
						homeTeamId: string;
						awayTeamId: string;
						kickoffAt: Date;
						stage: string | null;
						groupName: string | null;
					};
				}) =>
					state.matches.find(
						(match) =>
							match.tournamentId === where.tournamentId &&
							match.homeTeamId === where.homeTeamId &&
							match.awayTeamId === where.awayTeamId &&
							match.kickoffAt.getTime() === where.kickoffAt.getTime() &&
							match.stage === where.stage &&
							match.groupName === where.groupName,
					) ?? null,
			),
			findMany: jest.fn(
				async ({ where }: { where: { tournamentId: string } }) => {
					const matches = state.matches
						.filter((match) => match.tournamentId === where.tournamentId)
						.slice()
						.sort(
							(left, right) =>
								left.kickoffAt.getTime() - right.kickoffAt.getTime(),
						);

					return matches.map((match) => {
						const homeTeam = state.teams.find(
							(team) => team.id === match.homeTeamId,
						);
						const awayTeam = state.teams.find(
							(team) => team.id === match.awayTeamId,
						);
						const externalRefs = state.externalMatchReferences
							.filter(
								(reference) =>
									reference.matchId === match.id &&
									reference.providerKey === "mock",
							)
							.slice(0, 1)
							.map((reference) => ({ externalId: reference.externalId }));
						const externalResults = state.externalMatchResults
							.filter(
								(result) =>
									result.matchId === match.id && result.providerKey === "mock",
							)
							.slice()
							.sort(
								(left, right) =>
									(right.stagedAt?.getTime() ?? 0) -
									(left.stagedAt?.getTime() ?? 0),
							)
							.slice(0, 1)
							.map((result) => ({
								externalMatchId: result.externalMatchId,
								state: result.state,
								homeScore: result.homeScore,
								awayScore: result.awayScore,
								stagedAt:
									result.stagedAt ?? new Date("2026-05-08T12:00:00.000Z"),
								confirmedAt: result.confirmedAt,
								discardedAt: result.discardedAt,
							}));

						return {
							id: match.id,
							status: match.status,
							kickoffAt: match.kickoffAt,
							stage: match.stage,
							groupName: match.groupName,
							homeTeam: { name: homeTeam?.name ?? "" },
							awayTeam: { name: awayTeam?.name ?? "" },
							externalRefs,
							externalResults,
						};
					});
				},
			),
			create: jest.fn(async ({ data }: { data: Omit<MatchRecord, "id"> }) => {
				const record: MatchRecord = {
					id: `match-${state.matches.length + 1}`,
					...data,
				};
				state.matches.push(record);
				return { id: record.id };
			}),
			update: jest.fn(
				async ({
					where,
					data,
				}: {
					where: { id: string };
					data: Partial<Omit<MatchRecord, "id" | "tournamentId">> & {
						tournamentId?: string;
					};
				}) => {
					const match = state.matches.find(
						(candidate) => candidate.id === where.id,
					);

					if (match === undefined) {
						throw new Error(`Missing match ${where.id}`);
					}

					Object.assign(match, data);
					return match;
				},
			),
		},
		externalTeamReference: {
			findFirst: jest.fn(
				async ({
					where,
				}: {
					where: {
						providerKey: string;
						tournamentId: string;
						externalId: string;
					};
				}) =>
					state.externalTeamReferences.find(
						(reference) =>
							reference.providerKey === where.providerKey &&
							reference.tournamentId === where.tournamentId &&
							reference.externalId === where.externalId,
					) ?? null,
			),
			upsert: jest.fn(
				async ({
					where,
					create,
					update,
				}: {
					where: {
						providerKey_tournamentId_teamId: {
							providerKey: string;
							tournamentId: string;
							teamId: string;
						};
					};
					create: ExternalTeamReferenceRecord;
					update: Partial<ExternalTeamReferenceRecord>;
				}) => {
					const existing = state.externalTeamReferences.find(
						(reference) =>
							reference.providerKey ===
								where.providerKey_tournamentId_teamId.providerKey &&
							reference.tournamentId ===
								where.providerKey_tournamentId_teamId.tournamentId &&
							reference.teamId === where.providerKey_tournamentId_teamId.teamId,
					);

					if (existing === undefined) {
						const record = { ...create };
						state.externalTeamReferences.push(record);
						return record;
					}

					Object.assign(existing, update);
					return existing;
				},
			),
			create: jest.fn(
				async ({ data }: { data: ExternalTeamReferenceRecord }) => {
					const record = { ...data };
					state.externalTeamReferences.push(record);
					return record;
				},
			),
		},
		externalVenueReference: {
			findFirst: jest.fn(
				async ({
					where,
				}: {
					where: {
						providerKey: string;
						tournamentId: string;
						externalId: string;
					};
				}) =>
					state.externalVenueReferences.find(
						(reference) =>
							reference.providerKey === where.providerKey &&
							reference.tournamentId === where.tournamentId &&
							reference.externalId === where.externalId,
					) ?? null,
			),
			create: jest.fn(
				async ({ data }: { data: ExternalVenueReferenceRecord }) => {
					const record = { ...data };
					state.externalVenueReferences.push(record);
					return record;
				},
			),
			update: jest.fn(
				async ({
					where,
					data,
				}: {
					where: {
						providerKey_tournamentId_externalId: {
							providerKey: string;
							tournamentId: string;
							externalId: string;
						};
					};
					data: Partial<ExternalVenueReferenceRecord>;
				}) => {
					const reference = state.externalVenueReferences.find(
						(candidate) =>
							candidate.providerKey ===
								where.providerKey_tournamentId_externalId.providerKey &&
							candidate.tournamentId ===
								where.providerKey_tournamentId_externalId.tournamentId &&
							candidate.externalId ===
								where.providerKey_tournamentId_externalId.externalId,
					);

					if (reference === undefined) {
						throw new Error(`Missing external venue reference`);
					}

					Object.assign(reference, data);
					return reference;
				},
			),
		},
		externalMatchReference: {
			findFirst: jest.fn(
				async ({
					where,
				}: {
					where: {
						providerKey: string;
						tournamentId: string;
						externalId: string;
					};
				}) =>
					state.externalMatchReferences.find(
						(reference) =>
							reference.providerKey === where.providerKey &&
							reference.tournamentId === where.tournamentId &&
							reference.externalId === where.externalId,
					) ?? null,
			),
			create: jest.fn(
				async ({ data }: { data: ExternalMatchReferenceRecord }) => {
					const record = { ...data };
					state.externalMatchReferences.push(record);
					return record;
				},
			),
			update: jest.fn(
				async ({
					where,
					data,
				}: {
					where: {
						providerKey_tournamentId_externalId: {
							providerKey: string;
							tournamentId: string;
							externalId: string;
						};
					};
					data: Partial<ExternalMatchReferenceRecord>;
				}) => {
					const reference = state.externalMatchReferences.find(
						(candidate) =>
							candidate.providerKey ===
								where.providerKey_tournamentId_externalId.providerKey &&
							candidate.tournamentId ===
								where.providerKey_tournamentId_externalId.tournamentId &&
							candidate.externalId ===
								where.providerKey_tournamentId_externalId.externalId,
					);

					if (reference === undefined) {
						throw new Error(`Missing external match reference`);
					}

					Object.assign(reference, data);
					return reference;
				},
			),
		},
		externalSyncRun: {
			create: jest.fn(
				async ({
					data,
				}: {
					data: Omit<
						SyncRunRecord,
						| "id"
						| "importedCount"
						| "updatedCount"
						| "stagedCount"
						| "skippedCount"
						| "errorMessage"
						| "startedAt"
						| "completedAt"
					>;
				}) => {
					const record: SyncRunRecord = {
						id: `sync-${state.syncRuns.length + 1}`,
						importedCount: 0,
						updatedCount: 0,
						stagedCount: 0,
						skippedCount: 0,
						errorMessage: null,
						startedAt: new Date("2026-05-08T12:00:00.000Z"),
						completedAt: null,
						...data,
					};
					state.syncRuns.push(record);
					return record;
				},
			),
			findMany: jest.fn(
				async ({
					where,
					take,
				}: {
					where: { tournamentId: string; providerKey: string };
					take: number;
				}) =>
					state.syncRuns
						.filter(
							(run) =>
								run.tournamentId === where.tournamentId &&
								run.providerKey === where.providerKey,
						)
						.slice()
						.sort(
							(left, right) =>
								right.startedAt.getTime() - left.startedAt.getTime(),
						)
						.slice(0, take),
			),
			update: jest.fn(
				async ({
					where,
					data,
				}: {
					where: { id: string };
					data: Partial<SyncRunRecord> & { completedAt?: Date | null };
				}) => {
					const run = state.syncRuns.find(
						(candidate) => candidate.id === where.id,
					);

					if (run === undefined) {
						throw new Error(`Missing sync run ${where.id}`);
					}

					Object.assign(run, data);
					return run;
				},
			),
		},
		externalMatchResult: {
			findUnique: jest.fn(
				async ({ where }: { where: { id: string } }) =>
					state.externalMatchResults.find((result) => result.id === where.id) ??
					null,
			),
			findMany: jest.fn(
				async ({
					where,
				}: {
					where: { state?: ExternalMatchResultRecord["state"] };
				}) => {
					const filteredResults = state.externalMatchResults
						.filter(
							(result) =>
								where.state === undefined || result.state === where.state,
						)
						.slice()
						.sort(
							(left, right) =>
								(right.stagedAt?.getTime() ?? 0) -
								(left.stagedAt?.getTime() ?? 0),
						);

					return filteredResults.map((result) => {
						const match = result.matchId
							? (state.matches.find(
									(candidate) => candidate.id === result.matchId,
								) ?? null)
							: null;
						const homeTeam = match
							? (state.teams.find((team) => team.id === match.homeTeamId) ??
								null)
							: null;
						const awayTeam = match
							? (state.teams.find((team) => team.id === match.awayTeamId) ??
								null)
							: null;

						return {
							...result,
							stagedAt: result.stagedAt ?? new Date("2026-05-08T12:00:00.000Z"),
							match: match
								? {
										id: match.id,
										status: match.status,
										kickoffAt: match.kickoffAt,
										stage: match.stage,
										groupName: match.groupName,
										homeTeam: {
											name: homeTeam?.name ?? "",
										},
										awayTeam: {
											name: awayTeam?.name ?? "",
										},
									}
								: null,
						};
					});
				},
			),
			upsert: jest.fn(
				async ({
					where,
					create,
					update,
				}: {
					where: {
						providerKey_tournamentId_externalMatchId: {
							providerKey: string;
							tournamentId: string;
							externalMatchId: string;
						};
					};
					create: ExternalMatchResultRecord;
					update: Partial<ExternalMatchResultRecord>;
				}) => {
					const existing = state.externalMatchResults.find(
						(result) =>
							result.providerKey ===
								where.providerKey_tournamentId_externalMatchId.providerKey &&
							result.tournamentId ===
								where.providerKey_tournamentId_externalMatchId.tournamentId &&
							result.externalMatchId ===
								where.providerKey_tournamentId_externalMatchId.externalMatchId,
					);

					if (existing === undefined) {
						const record = {
							...create,
							id: `external-result-${state.externalMatchResults.length + 1}`,
							stagedAt: create.stagedAt ?? new Date("2026-05-08T12:00:00.000Z"),
							confirmedAt: null,
							discardedAt: null,
						};
						state.externalMatchResults.push(record);
						return record;
					}

					Object.assign(existing, update);
					return existing;
				},
			),
			update: jest.fn(
				async ({
					where,
					data,
				}: {
					where: { id: string };
					data: Partial<ExternalMatchResultRecord>;
				}) => {
					const result = state.externalMatchResults.find(
						(candidate) => candidate.id === where.id,
					);

					if (result === undefined) {
						throw new Error(`Missing external result ${where.id}`);
					}

					Object.assign(result, data);
					return result;
				},
			),
		},
	} as unknown as PrismaMock;
}

describe("SportsDataSyncService", () => {
	it("imports teams, venues, and fixtures idempotently", async () => {
		const state = createInitialState();
		const prisma = createPrismaMock(state);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		const firstRun = await service.importTournament();
		const secondRun = await service.importTournament();

		expect(firstRun.status).toBe("SUCCESS");
		expect(secondRun.status).toBe("SUCCESS");
		expect(state.teams).toHaveLength(8);
		expect(state.venues).toHaveLength(2);
		expect(state.matches).toHaveLength(4);
		expect(state.externalTeamReferences).toHaveLength(8);
		expect(state.externalVenueReferences).toHaveLength(2);
		expect(state.externalMatchReferences).toHaveLength(4);
		expect(state.syncRuns).toHaveLength(2);
	});

	it("resolves the tournament slug before invoking a football-data provider", async () => {
		const state = createInitialState({
			tournaments: [
				{
					id: "tournament-db-id",
					slug: "world-cup-2026-demo",
					status: TournamentStatus.ACTIVE,
					providerKey: "football-data",
				},
			],
		});
		const prisma = createPrismaMock(state);
		const provider = {
			providerKey: "football-data",
			listTeams: jest.fn(async () => []),
			listVenues: jest.fn(async () => []),
			listFixtures: jest.fn(async () => []),
			listFinalResults: jest.fn(async () => []),
		};
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(
				provider as unknown as MockSportsDataProvider,
				"football-data",
			),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-db-id"),
			) as unknown as MatchesService,
			createTournamentsServiceMock({
				id: "tournament-db-id",
				slug: "world-cup-2026",
				providerKey: "football-data",
			}) as unknown as TournamentsService,
		);

		await service.importTournament("tournament-db-id");

		expect(provider.listTeams).toHaveBeenCalledWith("world-cup-2026");
		expect(provider.listVenues).toHaveBeenCalledWith("world-cup-2026");
		expect(provider.listFixtures).toHaveBeenCalledWith("world-cup-2026");
	});

	it("resolves the tournament slug before invoking an api-sports provider", async () => {
		const state = createInitialState({
			tournaments: [
				{
					id: "liga-db-id",
					slug: "liga-argentina-2026",
					status: TournamentStatus.ACTIVE,
					providerKey: "api-sports",
				},
			],
		});
		const prisma = createPrismaMock(state);
		const provider = {
			providerKey: "api-sports",
			listTeams: jest.fn(async () => []),
			listVenues: jest.fn(async () => []),
			listFixtures: jest.fn(async () => []),
			listFinalResults: jest.fn(async () => []),
		};
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(
				provider as unknown as MockSportsDataProvider,
				"api-sports",
			),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "liga-db-id"),
			) as unknown as MatchesService,
			createTournamentsServiceMock({
				id: "liga-db-id",
				slug: "liga-argentina-2026",
				providerKey: "api-sports",
			}) as unknown as TournamentsService,
		);

		await service.importTournament("liga-db-id");

		expect(provider.listTeams).toHaveBeenCalledWith("liga-argentina-2026");
		expect(provider.listVenues).toHaveBeenCalledWith("liga-argentina-2026");
		expect(provider.listFixtures).toHaveBeenCalledWith("liga-argentina-2026");
	});

	it("resolves the tournament slug before invoking an lpf-web provider", async () => {
		const state = createInitialState({
			tournaments: [
				{
					id: "liga-db-id",
					slug: "liga-argentina-2026",
					status: TournamentStatus.ACTIVE,
					providerKey: "lpf-web",
				},
			],
		});
		const prisma = createPrismaMock(state);
		const provider = {
			providerKey: "lpf-web",
			listTeams: jest.fn(async () => []),
			listVenues: jest.fn(async () => []),
			listFixtures: jest.fn(async () => []),
			listFinalResults: jest.fn(async () => []),
		};
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(
				provider as unknown as MockSportsDataProvider,
				"lpf-web",
			),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "liga-db-id"),
			) as unknown as MatchesService,
			createTournamentsServiceMock({
				id: "liga-db-id",
				slug: "liga-argentina-2026",
				providerKey: "lpf-web",
			}) as unknown as TournamentsService,
		);

		await service.importTournament("liga-db-id");

		expect(provider.listTeams).toHaveBeenCalledWith("liga-argentina-2026");
		expect(provider.listVenues).toHaveBeenCalledWith("liga-argentina-2026");
		expect(provider.listFixtures).toHaveBeenCalledWith("liga-argentina-2026");
	});

	it("allows liga-argentina-2026 for provider sync", async () => {
		const state = createInitialState({
			tournaments: [
				{
					id: "liga-db-id",
					slug: "liga-argentina-2026",
					status: TournamentStatus.ACTIVE,
					providerKey: "mock",
				},
			],
		});
		const prisma = createPrismaMock(state);
		const provider = {
			providerKey: "api-sports",
			listTeams: jest.fn(async () => []),
			listVenues: jest.fn(async () => []),
			listFixtures: jest.fn(async () => []),
			listFinalResults: jest.fn(async () => []),
		};
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(
				provider as unknown as MockSportsDataProvider,
				"football-data",
			),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "liga-db-id"),
			) as unknown as MatchesService,
			createTournamentsServiceMock({
				id: "liga-db-id",
				slug: "liga-argentina-2026",
				providerKey: "lpf-web",
			}) as unknown as TournamentsService,
		);

		// Should not throw — liga-argentina-2026 is now in SUPPORTED_PROVIDER_TOURNAMENT_SLUGS
		await expect(service.importTournament("liga-db-id")).resolves.toMatchObject(
			{
				status: "SUCCESS",
			},
		);
	});

	it("still rejects unsupported tournaments for api-sports provider", async () => {
		const state = createInitialState();
		const prisma = createPrismaMock(state);
		const provider = {
			providerKey: "api-sports",
			listTeams: jest.fn(async () => []),
			listVenues: jest.fn(async () => []),
			listFixtures: jest.fn(async () => []),
			listFinalResults: jest.fn(async () => []),
		};

		// Create a mock that returns a demo/unsupported tournament
		const unsupportedTournamentsService = {
			listTournaments: jest.fn(),
			resolveTournamentContext: jest.fn(async () => ({
				tournament: {
					id: "demo-tournament-id",
					name: "Demo Tournament",
					slug: "demo-tournament",
					year: 2026,
					status: TournamentStatus.ACTIVE,
					startsAt: new Date("2026-01-01"),
					endsAt: new Date("2026-12-31"),
				},
				source: "explicit" as const,
			})),
			getStrictActiveTournament: jest.fn(),
			getActiveTournament: jest.fn(),
			getActiveTournamentMatches: jest.fn(),
			getTournamentMatches: jest.fn(),
		} as unknown as TournamentsService;

		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(
				provider as unknown as MockSportsDataProvider,
				"football-data",
			),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			unsupportedTournamentsService,
		);

		await expect(
			service.importTournament("demo-tournament-id"),
		).rejects.toThrow("does not support provider sync operations");
	});

	it("records success with zero staged results when the provider has nothing to finalize", async () => {
		const state = createInitialState();
		const prisma = createPrismaMock(state);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		const summary = await service.syncResults();

		expect(summary).toMatchObject({
			status: "SUCCESS",
			stagedCount: 0,
			importedCount: 0,
			updatedCount: 0,
		});
		expect(state.externalMatchResults).toHaveLength(0);
	});

	it("rejects import for unsupported provider tournaments (demo tournaments)", async () => {
		const state = createInitialState();
		const prisma = createPrismaMock(state);

		// Create a mock that returns a demo/unsupported tournament
		const unsupportedTournamentsService = {
			listTournaments: jest.fn(),
			resolveTournamentContext: jest.fn(async () => ({
				tournament: {
					id: "demo-tournament-id",
					name: "Demo Tournament",
					slug: "demo-tournament", // Not in SUPPORTED_PROVIDER_TOURNAMENT_SLUGS
					year: 2026,
					status: TournamentStatus.ACTIVE,
					startsAt: new Date("2026-01-01"),
					endsAt: new Date("2026-12-31"),
				},
				source: "explicit" as const,
			})),
			getStrictActiveTournament: jest.fn(),
			getActiveTournament: jest.fn(),
			getActiveTournamentMatches: jest.fn(),
			getTournamentMatches: jest.fn(),
		} as unknown as TournamentsService;

		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			unsupportedTournamentsService,
		);

		await expect(
			service.importTournament("demo-tournament-id"),
		).rejects.toThrow("does not support provider sync operations");
	});

	it("rejects sync results for unsupported provider tournaments (demo tournaments)", async () => {
		const state = createInitialState();
		const prisma = createPrismaMock(state);

		// Create a mock that returns a demo/unsupported tournament
		const unsupportedTournamentsService = {
			listTournaments: jest.fn(),
			resolveTournamentContext: jest.fn(async () => ({
				tournament: {
					id: "demo-tournament-id",
					name: "Demo Tournament",
					slug: "demo-tournament", // Not in SUPPORTED_PROVIDER_TOURNAMENT_SLUGS
					year: 2026,
					status: TournamentStatus.ACTIVE,
					startsAt: new Date("2026-01-01"),
					endsAt: new Date("2026-12-31"),
				},
				source: "explicit" as const,
			})),
			getStrictActiveTournament: jest.fn(),
			getActiveTournament: jest.fn(),
			getActiveTournamentMatches: jest.fn(),
			getTournamentMatches: jest.fn(),
		} as unknown as TournamentsService;

		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			unsupportedTournamentsService,
		);

		await expect(service.syncResults("demo-tournament-id")).rejects.toThrow(
			"does not support provider sync operations",
		);
	});

	it("lists pending staged results with linked match context", async () => {
		const state = createInitialState({
			teams: [
				{
					id: "team-1",
					tournamentId: "tournament-1",
					name: "Argentina",
					shortName: "ARG",
					countryCode: "AR",
					flagCode: "ARG",
					primaryColor: "#74ACDF",
					secondaryColor: "#F6E7A1",
				},
				{
					id: "team-2",
					tournamentId: "tournament-1",
					name: "England",
					shortName: "ENG",
					countryCode: "GB-ENG",
					flagCode: "ENG",
					primaryColor: "#FFFFFF",
					secondaryColor: "#CE1124",
				},
			],
			matches: [
				{
					id: "match-1",
					tournamentId: "tournament-1",
					homeTeamId: "team-1",
					awayTeamId: "team-2",
					venueId: null,
					kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
					stage: "Group Stage",
					groupName: "Group A",
					status: MatchStatus.UPCOMING,
				},
			],
			externalMatchResults: [
				{
					id: "external-result-1",
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalMatchId: "fixture-arg-eng",
					matchId: "match-1",
					externalSyncRunId: "sync-1",
					homeScore: 2,
					awayScore: 1,
					playedAt: new Date("2026-06-11T19:00:00.000Z"),
					stagedAt: new Date("2026-06-11T20:00:00.000Z"),
					state: "PENDING_CONFIRMATION",
					confirmedAt: null,
					discardedAt: null,
				},
				{
					id: "external-result-2",
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalMatchId: "fixture-arg-mex",
					matchId: null,
					externalSyncRunId: "sync-1",
					homeScore: 0,
					awayScore: 0,
					playedAt: null,
					stagedAt: new Date("2026-06-11T21:00:00.000Z"),
					state: "CONFIRMED",
					confirmedAt: new Date("2026-06-11T21:05:00.000Z"),
					discardedAt: null,
				},
			],
		});
		const prisma = createPrismaMock(state);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		const results = await service.listExternalMatchResults();

		expect(results).toEqual([
			{
				id: "external-result-1",
				providerKey: "mock",
				externalMatchId: "fixture-arg-eng",
				matchId: "match-1",
				state: "PENDING_CONFIRMATION",
				homeScore: 2,
				awayScore: 1,
				playedAt: new Date("2026-06-11T19:00:00.000Z"),
				stagedAt: new Date("2026-06-11T20:00:00.000Z"),
				confirmedAt: null,
				discardedAt: null,
				match: {
					matchId: "match-1",
					status: MatchStatus.UPCOMING,
					kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
					homeTeamName: "Argentina",
					awayTeamName: "England",
					stage: "Group Stage",
					groupName: "Group A",
				},
			},
		]);
		expect(prisma.externalMatchResult.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { state: "PENDING_CONFIRMATION", tournamentId: "tournament-1" },
				orderBy: { stagedAt: "desc" },
			}),
		);
	});

	it("filters external match results by explicit tournament context", async () => {
		const state = createInitialState();
		const prisma = createPrismaMock(state);

		// Create a mock that returns tournament-2 when explicitly requested
		const tournamentsService = {
			listTournaments: jest.fn(),
			resolveTournamentContext: jest.fn(
				async (input: TournamentContextInput) => {
					if (input?.explicitTournamentId === "tournament-2") {
						return {
							tournament: {
								id: "tournament-2",
								name: "World Cup 2026",
								slug: "world-cup-2026",
								year: 2026,
								status: TournamentStatus.ACTIVE,
								startsAt: new Date("2026-06-11"),
								endsAt: new Date("2026-07-19"),
							},
							source: "explicit" as const,
						};
					}
					return {
						tournament: {
							id: "tournament-1",
							name: "World Cup 2026",
							slug: "world-cup-2026",
							year: 2026,
							status: TournamentStatus.ACTIVE,
							startsAt: new Date("2026-06-11"),
							endsAt: new Date("2026-07-19"),
						},
						source: "active" as const,
					};
				},
			),
			getStrictActiveTournament: jest.fn(),
			getActiveTournament: jest.fn(),
			getActiveTournamentMatches: jest.fn(),
			getTournamentMatches: jest.fn(),
		} as unknown as TournamentsService;

		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			tournamentsService,
		);

		// Request results for tournament-2 explicitly
		await service.listExternalMatchResults({
			state: "PENDING_CONFIRMATION",
			tournamentContext: { explicitTournamentId: "tournament-2" },
		});

		// Verify the query was made with tournament-2
		expect(prisma.externalMatchResult.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { state: "PENDING_CONFIRMATION", tournamentId: "tournament-2" },
			}),
		);
	});

	it("lists external mapping diagnostics for active tournament matches", async () => {
		const state = createInitialState({
			teams: [
				{
					id: "team-1",
					tournamentId: "tournament-1",
					name: "Argentina",
					shortName: "ARG",
					countryCode: "AR",
					flagCode: "ARG",
					primaryColor: null,
					secondaryColor: null,
				},
				{
					id: "team-2",
					tournamentId: "tournament-1",
					name: "England",
					shortName: "ENG",
					countryCode: "GB-ENG",
					flagCode: "ENG",
					primaryColor: null,
					secondaryColor: null,
				},
			],
			matches: [
				{
					id: "match-1",
					tournamentId: "tournament-1",
					homeTeamId: "team-1",
					awayTeamId: "team-2",
					venueId: null,
					kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
					stage: "Group Stage",
					groupName: "Group A",
					status: MatchStatus.UPCOMING,
				},
			],
			externalMatchReferences: [
				{
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalId: "fixture-arg-eng",
					matchId: "match-1",
				},
			],
			externalMatchResults: [
				{
					id: "external-result-1",
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalMatchId: "fixture-arg-eng",
					matchId: "match-1",
					externalSyncRunId: "sync-1",
					homeScore: 2,
					awayScore: 1,
					playedAt: new Date("2026-06-11T19:00:00.000Z"),
					stagedAt: new Date("2026-06-11T20:00:00.000Z"),
					state: "PENDING_CONFIRMATION",
					confirmedAt: null,
					discardedAt: null,
				},
			],
		});
		const prisma = createPrismaMock(state);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		const diagnostics = await service.listExternalMatchMappingDiagnostics();

		expect(diagnostics).toEqual([
			{
				matchId: "match-1",
				status: MatchStatus.UPCOMING,
				kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
				homeTeamName: "Argentina",
				awayTeamName: "England",
				stage: "Group Stage",
				groupName: "Group A",
				externalMatchId: "fixture-arg-eng",
				hasExternalReference: true,
				latestExternalResult: {
					externalMatchId: "fixture-arg-eng",
					state: "PENDING_CONFIRMATION",
					homeScore: 2,
					awayScore: 1,
					stagedAt: new Date("2026-06-11T20:00:00.000Z"),
					confirmedAt: null,
					discardedAt: null,
				},
			},
		]);
	});

	it("lists recent sync runs for the active tournament and provider", async () => {
		const state = createInitialState({
			syncRuns: [
				{
					id: "sync-1",
					providerKey: "mock",
					tournamentId: "tournament-1",
					syncType: "IMPORT",
					status: "SUCCESS",
					importedCount: 14,
					updatedCount: 0,
					stagedCount: 0,
					skippedCount: 0,
					errorMessage: null,
					startedAt: new Date("2026-05-08T12:00:00.000Z"),
					completedAt: new Date("2026-05-08T12:01:00.000Z"),
				},
				{
					id: "sync-2",
					providerKey: "mock",
					tournamentId: "tournament-1",
					syncType: "RESULTS",
					status: "SUCCESS",
					importedCount: 0,
					updatedCount: 0,
					stagedCount: 4,
					skippedCount: 0,
					errorMessage: null,
					startedAt: new Date("2026-05-08T13:00:00.000Z"),
					completedAt: new Date("2026-05-08T13:01:00.000Z"),
				},
			],
		});
		const prisma = createPrismaMock(state);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		const syncRuns = await service.listRecentSyncRuns();

		expect(syncRuns).toEqual([
			{
				syncRunId: "sync-2",
				providerKey: "mock",
				tournamentId: "tournament-1",
				syncType: "RESULTS",
				status: "SUCCESS",
				importedCount: 0,
				updatedCount: 0,
				stagedCount: 4,
				skippedCount: 0,
				errorMessage: null,
				startedAt: new Date("2026-05-08T13:00:00.000Z"),
				completedAt: new Date("2026-05-08T13:01:00.000Z"),
			},
			{
				syncRunId: "sync-1",
				providerKey: "mock",
				tournamentId: "tournament-1",
				syncType: "IMPORT",
				status: "SUCCESS",
				importedCount: 14,
				updatedCount: 0,
				stagedCount: 0,
				skippedCount: 0,
				errorMessage: null,
				startedAt: new Date("2026-05-08T12:00:00.000Z"),
				completedAt: new Date("2026-05-08T12:01:00.000Z"),
			},
		]);
		expect(prisma.externalSyncRun.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { tournamentId: "tournament-1", providerKey: "mock" },
				orderBy: { startedAt: "desc" },
				take: 6,
			}),
		);
	});

	it("stages final results idempotently without invoking match finalization", async () => {
		const state = createInitialState({
			matches: [
				{
					id: "match-1",
					tournamentId: "tournament-1",
					homeTeamId: "team-1",
					awayTeamId: "team-2",
					venueId: null,
					kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
					stage: "Group Stage",
					groupName: "Group A",
					status: MatchStatus.UPCOMING,
				},
			],
			externalMatchReferences: [
				{
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalId: "fixture-arg-eng",
					matchId: "match-1",
				},
			],
		});
		const prisma = createPrismaMock(state);
		const provider = createProvider([
			{
				externalMatchId: "fixture-arg-eng",
				homeScore: 2,
				awayScore: 1,
				playedAt: new Date("2026-06-11T19:00:00.000Z"),
			},
		]);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(provider),
			createMatchesServiceMock(
				createFinalizeMatchSummary("match-1", "tournament-1"),
			) as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		const firstRun = await service.syncResults();
		const secondRun = await service.syncResults();

		expect(firstRun).toMatchObject({ status: "SUCCESS", stagedCount: 1 });
		expect(secondRun).toMatchObject({ status: "SUCCESS", stagedCount: 1 });
		expect(state.externalMatchResults).toHaveLength(1);
		expect(state.externalMatchResults[0]).toMatchObject({
			externalMatchId: "fixture-arg-eng",
			matchId: "match-1",
			homeScore: 2,
			awayScore: 1,
			state: "PENDING_CONFIRMATION",
		});
		expect(prisma.match.update).not.toHaveBeenCalled();
	});

	it("confirms a pending staged result by finalizing the linked match", async () => {
		const state = createInitialState({
			matches: [
				{
					id: "match-1",
					tournamentId: "tournament-1",
					homeTeamId: "team-1",
					awayTeamId: "team-2",
					venueId: null,
					kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
					stage: "Group Stage",
					groupName: "Group A",
					status: MatchStatus.UPCOMING,
				},
			],
			externalMatchResults: [
				{
					id: "external-result-1",
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalMatchId: "fixture-arg-eng",
					matchId: "match-1",
					externalSyncRunId: "sync-1",
					homeScore: 2,
					awayScore: 1,
					playedAt: new Date("2026-06-11T19:00:00.000Z"),
					state: "PENDING_CONFIRMATION",
					confirmedAt: null,
					discardedAt: null,
				},
			],
		});
		const prisma = createPrismaMock(state);
		const finalizeSummary = createFinalizeMatchSummary(
			"match-1",
			"tournament-1",
		);
		const matchesService = createMatchesServiceMock(finalizeSummary);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			matchesService as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		const summary = await service.confirmExternalMatchResult({
			externalMatchResultId: "external-result-1",
		});

		expect(summary).toMatchObject({
			externalMatchResultId: "external-result-1",
			externalMatchId: "fixture-arg-eng",
			matchId: "match-1",
			tournamentId: "tournament-1",
			state: "CONFIRMED",
			finalizationSummary: finalizeSummary,
		});
		expect(matchesService.finalizeMatch).toHaveBeenCalledWith({
			matchId: "match-1",
			homeScore: 2,
			awayScore: 1,
		});
		expect(state.externalMatchResults[0]).toMatchObject({
			state: "CONFIRMED",
			confirmedAt: expect.any(Date),
			discardedAt: null,
		});
	});

	it("discards a pending staged result without finalizing the linked match", async () => {
		const state = createInitialState({
			externalMatchResults: [
				{
					id: "external-result-1",
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalMatchId: "fixture-arg-eng",
					matchId: "match-1",
					externalSyncRunId: "sync-1",
					homeScore: 2,
					awayScore: 1,
					playedAt: new Date("2026-06-11T19:00:00.000Z"),
					state: "PENDING_CONFIRMATION",
					confirmedAt: null,
					discardedAt: null,
				},
			],
		});
		const prisma = createPrismaMock(state);
		const matchesService = createMatchesServiceMock(
			createFinalizeMatchSummary("match-1", "tournament-1"),
		);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			matchesService as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		const summary = await service.discardExternalMatchResult({
			externalMatchResultId: "external-result-1",
		});

		expect(summary).toMatchObject({
			externalMatchResultId: "external-result-1",
			externalMatchId: "fixture-arg-eng",
			matchId: "match-1",
			tournamentId: "tournament-1",
			state: "DISCARDED",
		});
		expect(matchesService.finalizeMatch).not.toHaveBeenCalled();
		expect(state.externalMatchResults[0]).toMatchObject({
			state: "DISCARDED",
			confirmedAt: null,
			discardedAt: expect.any(Date),
		});
	});

	it("rejects a staged result without a linked internal match", async () => {
		const state = createInitialState({
			externalMatchResults: [
				{
					id: "external-result-1",
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalMatchId: "fixture-arg-eng",
					matchId: null,
					externalSyncRunId: "sync-1",
					homeScore: 2,
					awayScore: 1,
					playedAt: new Date("2026-06-11T19:00:00.000Z"),
					state: "PENDING_CONFIRMATION",
					confirmedAt: null,
					discardedAt: null,
				},
			],
		});
		const prisma = createPrismaMock(state);
		const matchesService = createMatchesServiceMock(
			createFinalizeMatchSummary("match-1", "tournament-1"),
		);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			matchesService as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		await expect(
			service.confirmExternalMatchResult({
				externalMatchResultId: "external-result-1",
			}),
		).rejects.toThrow("is not linked to an internal match");
		expect(matchesService.finalizeMatch).not.toHaveBeenCalled();
	});

	it("rejects an already confirmed staged result", async () => {
		const state = createInitialState({
			externalMatchResults: [
				{
					id: "external-result-1",
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalMatchId: "fixture-arg-eng",
					matchId: "match-1",
					externalSyncRunId: "sync-1",
					homeScore: 2,
					awayScore: 1,
					playedAt: new Date("2026-06-11T19:00:00.000Z"),
					state: "CONFIRMED",
					confirmedAt: new Date("2026-06-11T20:00:00.000Z"),
					discardedAt: null,
				},
			],
		});
		const prisma = createPrismaMock(state);
		const matchesService = createMatchesServiceMock(
			createFinalizeMatchSummary("match-1", "tournament-1"),
		);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			matchesService as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		await expect(
			service.confirmExternalMatchResult({
				externalMatchResultId: "external-result-1",
			}),
		).rejects.toThrow("already confirmed");
		expect(matchesService.finalizeMatch).not.toHaveBeenCalled();
	});

	it("rejects an already discarded staged result", async () => {
		const state = createInitialState({
			externalMatchResults: [
				{
					id: "external-result-1",
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalMatchId: "fixture-arg-eng",
					matchId: "match-1",
					externalSyncRunId: "sync-1",
					homeScore: 2,
					awayScore: 1,
					playedAt: new Date("2026-06-11T19:00:00.000Z"),
					state: "DISCARDED",
					confirmedAt: null,
					discardedAt: new Date("2026-06-11T20:00:00.000Z"),
				},
			],
		});
		const prisma = createPrismaMock(state);
		const matchesService = createMatchesServiceMock(
			createFinalizeMatchSummary("match-1", "tournament-1"),
		);
		const service = new SportsDataSyncService(
			prisma as unknown as PrismaService,
			createMockFactory(createProvider()),
			matchesService as unknown as MatchesService,
			createTournamentsServiceMock() as unknown as TournamentsService,
		);

		await expect(
			service.discardExternalMatchResult({
				externalMatchResultId: "external-result-1",
			}),
		).rejects.toThrow("already discarded");
		expect(matchesService.finalizeMatch).not.toHaveBeenCalled();
	});

	describe("cross-tournament coexistence", () => {
		it("does not cross-link teams when two tournaments share the same provider external team id", async () => {
			// Both tournaments have a team named "Argentina" but they are distinct internal teams.
			// They share the same provider external id "team-argentina". The sync must scope
			// the external reference lookup to the tournament so tournament-1's Argentina does
			// not get linked to tournament-2's internal team.
			const state = createInitialState({
				tournaments: [
					{
						id: "tournament-1",
						slug: "world-cup-2026",
						status: TournamentStatus.ACTIVE,
						providerKey: "mock",
					},
					{
						id: "tournament-2",
						slug: "euro-2026",
						status: TournamentStatus.ACTIVE,
						providerKey: "mock",
					},
				],
				teams: [
					{
						id: "team-t1-arg",
						tournamentId: "tournament-1",
						name: "Argentina",
						shortName: "ARG",
						countryCode: "AR",
						flagCode: "ARG",
						primaryColor: "#74ACDF",
						secondaryColor: "#F6E7A1",
					},
					{
						id: "team-t2-arg",
						tournamentId: "tournament-2",
						name: "Argentina",
						shortName: "ARG",
						countryCode: "AR",
						flagCode: "ARG",
						primaryColor: "#74ACDF",
						secondaryColor: "#F6E7A1",
					},
				],
				// Only tournament-1 has an external reference for this provider+externalId
				externalTeamReferences: [
					{
						providerKey: "mock",
						tournamentId: "tournament-1",
						externalId: "team-argentina",
						teamId: "team-t1-arg",
					},
				],
			});
			const prisma = createPrismaMock(state);

			const tournamentsService = {
				listTournaments: jest.fn(),
				resolveTournamentContext: jest.fn(
					async (input: TournamentContextInput) => {
						const id = input?.explicitTournamentId ?? "tournament-1";
						return {
							tournament: {
								id,
								name: id === "tournament-1" ? "World Cup 2026" : "Euro 2026",
								slug: "world-cup-2026",
								year: 2026,
								status: TournamentStatus.ACTIVE,
								startsAt: new Date("2026-06-11"),
								endsAt: new Date("2026-07-19"),
							},
							source: "explicit" as const,
						};
					},
				),
				getStrictActiveTournament: jest.fn(),
				getActiveTournament: jest.fn(),
				getActiveTournamentMatches: jest.fn(),
				getTournamentMatches: jest.fn(),
			} as unknown as TournamentsService;

			const provider = new MockSportsDataProvider({
				teams: [
					{
						externalId: "team-argentina",
						name: "Argentina",
						shortName: "ARG",
						countryCode: "AR",
						flagCode: "ARG",
						primaryColor: "#74ACDF",
						secondaryColor: "#F6E7A1",
						crestUrl: null,
					},
				],
				venues: [],
				fixtures: [],
				finalResults: [],
			});

			const service = new SportsDataSyncService(
				prisma as unknown as PrismaService,
				createMockFactory(provider),
				createMatchesServiceMock(
					createFinalizeMatchSummary("match-1", "tournament-1"),
				) as unknown as MatchesService,
				tournamentsService,
			);

			// Sync tournament-2 — Argentina already exists (found by tournamentId_name) but has no
			// external reference for this provider. The code must call upsert to create one scoped
			// to tournament-2, WITHOUT affecting tournament-1's reference.
			await service.importTournament("tournament-2");

			// tournament-1 reference must be untouched
			expect(state.externalTeamReferences).toContainEqual(
				expect.objectContaining({
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalId: "team-argentina",
					teamId: "team-t1-arg",
				}),
			);
			// tournament-2 must now have its own reference pointing to its own team
			expect(state.externalTeamReferences).toContainEqual(
				expect.objectContaining({
					providerKey: "mock",
					tournamentId: "tournament-2",
					externalId: "team-argentina",
					teamId: "team-t2-arg",
				}),
			);
		});

		it("does not resolve the wrong venue when two tournaments share the same provider external venue id", async () => {
			const state = createInitialState({
				tournaments: [
					{
						id: "tournament-1",
						slug: "world-cup-2026",
						status: TournamentStatus.ACTIVE,
						providerKey: "mock",
					},
					{
						id: "tournament-2",
						slug: "euro-2026",
						status: TournamentStatus.ACTIVE,
						providerKey: "mock",
					},
				],
				venues: [
					{
						id: "venue-t1",
						tournamentId: "tournament-1",
						name: "Estadio Azteca",
						city: "Mexico City",
						countryCode: "MX",
						capacity: 87523,
					},
					{
						id: "venue-t2",
						tournamentId: "tournament-2",
						name: "Estadio Azteca",
						city: "Mexico City",
						countryCode: "MX",
						capacity: 87523,
					},
				],
				externalVenueReferences: [
					{
						providerKey: "mock",
						tournamentId: "tournament-1",
						externalId: "venue-azteca",
						venueId: "venue-t1",
					},
				],
			});
			const prisma = createPrismaMock(state);

			const tournamentsService = {
				listTournaments: jest.fn(),
				resolveTournamentContext: jest.fn(
					async (input: TournamentContextInput) => {
						const id = input?.explicitTournamentId ?? "tournament-1";
						return {
							tournament: {
								id,
								name: id === "tournament-1" ? "World Cup 2026" : "Euro 2026",
								slug: "world-cup-2026",
								year: 2026,
								status: TournamentStatus.ACTIVE,
								startsAt: new Date("2026-06-11"),
								endsAt: new Date("2026-07-19"),
							},
							source: "explicit" as const,
						};
					},
				),
				getStrictActiveTournament: jest.fn(),
				getActiveTournament: jest.fn(),
				getActiveTournamentMatches: jest.fn(),
				getTournamentMatches: jest.fn(),
			} as unknown as TournamentsService;

			const provider = new MockSportsDataProvider({
				teams: [],
				venues: [
					{
						externalId: "venue-azteca",
						name: "Estadio Azteca",
						city: "Mexico City",
						countryCode: "MX",
						capacity: 87523,
					},
				],
				fixtures: [],
				finalResults: [],
			});

			const service = new SportsDataSyncService(
				prisma as unknown as PrismaService,
				createMockFactory(provider),
				createMatchesServiceMock(
					createFinalizeMatchSummary("match-1", "tournament-1"),
				) as unknown as MatchesService,
				tournamentsService,
			);

			await service.importTournament("tournament-2");

			// tournament-1's reference is untouched
			expect(state.externalVenueReferences).toContainEqual(
				expect.objectContaining({
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalId: "venue-azteca",
					venueId: "venue-t1",
				}),
			);
			// tournament-2 gets its own reference pointing to its own venue
			expect(state.externalVenueReferences).toContainEqual(
				expect.objectContaining({
					providerKey: "mock",
					tournamentId: "tournament-2",
					externalId: "venue-azteca",
					venueId: "venue-t2",
				}),
			);
		});

		it("does not resolve or update the wrong match when two tournaments share the same provider external match id", async () => {
			const state = createInitialState({
				tournaments: [
					{
						id: "tournament-1",
						slug: "world-cup-2026",
						status: TournamentStatus.ACTIVE,
						providerKey: "mock",
					},
					{
						id: "tournament-2",
						slug: "euro-2026",
						status: TournamentStatus.ACTIVE,
						providerKey: "mock",
					},
				],
				teams: [
					{
						id: "t1-home",
						tournamentId: "tournament-1",
						name: "Argentina",
						shortName: "ARG",
						countryCode: "AR",
						flagCode: "ARG",
						primaryColor: null,
						secondaryColor: null,
					},
					{
						id: "t1-away",
						tournamentId: "tournament-1",
						name: "Brazil",
						shortName: "BRA",
						countryCode: "BR",
						flagCode: "BRA",
						primaryColor: null,
						secondaryColor: null,
					},
					{
						id: "t2-home",
						tournamentId: "tournament-2",
						name: "Argentina",
						shortName: "ARG",
						countryCode: "AR",
						flagCode: "ARG",
						primaryColor: null,
						secondaryColor: null,
					},
					{
						id: "t2-away",
						tournamentId: "tournament-2",
						name: "Brazil",
						shortName: "BRA",
						countryCode: "BR",
						flagCode: "BRA",
						primaryColor: null,
						secondaryColor: null,
					},
				],
				venues: [
					{
						id: "venue-t1",
						tournamentId: "tournament-1",
						name: "Estadio Azteca",
						city: "Mexico City",
						countryCode: "MX",
						capacity: 87523,
					},
					{
						id: "venue-t2",
						tournamentId: "tournament-2",
						name: "Estadio Azteca",
						city: "Mexico City",
						countryCode: "MX",
						capacity: 87523,
					},
				],
				matches: [
					{
						id: "match-t1",
						tournamentId: "tournament-1",
						homeTeamId: "t1-home",
						awayTeamId: "t1-away",
						venueId: "venue-t1",
						kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
						stage: "Group Stage",
						groupName: "Group A",
						status: MatchStatus.UPCOMING,
					},
					{
						id: "match-t2",
						tournamentId: "tournament-2",
						homeTeamId: "t2-home",
						awayTeamId: "t2-away",
						venueId: "venue-t2",
						kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
						stage: "Group Stage",
						groupName: "Group A",
						status: MatchStatus.UPCOMING,
					},
				],
				externalMatchReferences: [
					{
						providerKey: "mock",
						tournamentId: "tournament-1",
						externalId: "fixture-arg-bra",
						matchId: "match-t1",
					},
					{
						providerKey: "mock",
						tournamentId: "tournament-2",
						externalId: "fixture-arg-bra",
						matchId: "match-t2",
					},
				],
				// Pre-populate team refs so resolveTeamIdForTournament works for tournament-2
				externalTeamReferences: [
					{
						providerKey: "mock",
						tournamentId: "tournament-1",
						externalId: "team-argentina",
						teamId: "t1-home",
					},
					{
						providerKey: "mock",
						tournamentId: "tournament-1",
						externalId: "team-brazil",
						teamId: "t1-away",
					},
					{
						providerKey: "mock",
						tournamentId: "tournament-2",
						externalId: "team-argentina",
						teamId: "t2-home",
					},
					{
						providerKey: "mock",
						tournamentId: "tournament-2",
						externalId: "team-brazil",
						teamId: "t2-away",
					},
				],
				// Pre-populate venue refs so resolveVenueId works for tournament-2
				externalVenueReferences: [
					{
						providerKey: "mock",
						tournamentId: "tournament-1",
						externalId: "venue-azteca",
						venueId: "venue-t1",
					},
					{
						providerKey: "mock",
						tournamentId: "tournament-2",
						externalId: "venue-azteca",
						venueId: "venue-t2",
					},
				],
			});
			const prisma = createPrismaMock(state);

			const tournamentsService = {
				listTournaments: jest.fn(),
				resolveTournamentContext: jest.fn(
					async (input: TournamentContextInput) => {
						const id = input?.explicitTournamentId ?? "tournament-1";
						return {
							tournament: {
								id,
								name: id === "tournament-1" ? "World Cup 2026" : "Euro 2026",
								slug: "world-cup-2026",
								year: 2026,
								status: TournamentStatus.ACTIVE,
								startsAt: new Date("2026-06-11"),
								endsAt: new Date("2026-07-19"),
							},
							source: "explicit" as const,
						};
					},
				),
				getStrictActiveTournament: jest.fn(),
				getActiveTournament: jest.fn(),
				getActiveTournamentMatches: jest.fn(),
				getTournamentMatches: jest.fn(),
			} as unknown as TournamentsService;

			const provider = new MockSportsDataProvider({
				teams: [],
				venues: [],
				fixtures: [
					{
						externalId: "fixture-arg-bra",
						homeTeamExternalId: "team-argentina",
						awayTeamExternalId: "team-brazil",
						venueExternalId: "venue-azteca",
						kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
						stage: "Group Stage",
						groupName: "Group A",
					},
				],
				finalResults: [],
			});

			const service = new SportsDataSyncService(
				prisma as unknown as PrismaService,
				createMockFactory(provider),
				createMatchesServiceMock(
					createFinalizeMatchSummary("match-1", "tournament-1"),
				) as unknown as MatchesService,
				tournamentsService,
			);

			await service.importTournament("tournament-2");

			// tournament-1's reference must not be overwritten — match-t1 must still be linked to fixture-arg-bra
			expect(state.externalMatchReferences).toContainEqual(
				expect.objectContaining({
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalId: "fixture-arg-bra",
					matchId: "match-t1",
				}),
			);
			// tournament-2 gets its own reference pointing to match-t2
			expect(state.externalMatchReferences).toContainEqual(
				expect.objectContaining({
					providerKey: "mock",
					tournamentId: "tournament-2",
					externalId: "fixture-arg-bra",
					matchId: "match-t2",
				}),
			);
		});

		it("does not overwrite staged results when two tournaments stage results with the same provider external match id", async () => {
			const state = createInitialState({
				tournaments: [
					{
						id: "tournament-1",
						slug: "world-cup-2026",
						status: TournamentStatus.ACTIVE,
						providerKey: "mock",
					},
					{
						id: "tournament-2",
						slug: "euro-2026",
						status: TournamentStatus.ACTIVE,
						providerKey: "mock",
					},
				],
				teams: [
					{
						id: "t1-home",
						tournamentId: "tournament-1",
						name: "Argentina",
						shortName: "ARG",
						countryCode: "AR",
						flagCode: "ARG",
						primaryColor: null,
						secondaryColor: null,
					},
					{
						id: "t1-away",
						tournamentId: "tournament-1",
						name: "Brazil",
						shortName: "BRA",
						countryCode: "BR",
						flagCode: "BRA",
						primaryColor: null,
						secondaryColor: null,
					},
					{
						id: "t2-home",
						tournamentId: "tournament-2",
						name: "Argentina",
						shortName: "ARG",
						countryCode: "AR",
						flagCode: "ARG",
						primaryColor: null,
						secondaryColor: null,
					},
					{
						id: "t2-away",
						tournamentId: "tournament-2",
						name: "Brazil",
						shortName: "BRA",
						countryCode: "BR",
						flagCode: "BRA",
						primaryColor: null,
						secondaryColor: null,
					},
				],
				matches: [
					{
						id: "match-t1",
						tournamentId: "tournament-1",
						homeTeamId: "t1-home",
						awayTeamId: "t1-away",
						venueId: null,
						kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
						stage: "Group Stage",
						groupName: "Group A",
						status: MatchStatus.UPCOMING,
					},
					{
						id: "match-t2",
						tournamentId: "tournament-2",
						homeTeamId: "t2-home",
						awayTeamId: "t2-away",
						venueId: null,
						kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
						stage: "Group Stage",
						groupName: "Group A",
						status: MatchStatus.UPCOMING,
					},
				],
				externalMatchReferences: [
					{
						providerKey: "mock",
						tournamentId: "tournament-1",
						externalId: "fixture-arg-bra",
						matchId: "match-t1",
					},
					{
						providerKey: "mock",
						tournamentId: "tournament-2",
						externalId: "fixture-arg-bra",
						matchId: "match-t2",
					},
				],
				// Pre-stage a result for tournament-1 so we can verify it survives the tournament-2 sync
				externalMatchResults: [
					{
						id: "existing-result-t1",
						providerKey: "mock",
						tournamentId: "tournament-1",
						externalMatchId: "fixture-arg-bra",
						matchId: "match-t1",
						externalSyncRunId: "sync-t1",
						homeScore: 2,
						awayScore: 1,
						playedAt: new Date("2026-06-11T19:00:00.000Z"),
						stagedAt: new Date("2026-06-11T20:00:00.000Z"),
						state: "PENDING_CONFIRMATION",
						confirmedAt: null,
						discardedAt: null,
					},
				],
			});
			const prisma = createPrismaMock(state);

			const tournamentsService = {
				listTournaments: jest.fn(),
				resolveTournamentContext: jest.fn(
					async (input: TournamentContextInput) => {
						const id = input?.explicitTournamentId ?? "tournament-1";
						return {
							tournament: {
								id,
								name: id === "tournament-1" ? "World Cup 2026" : "Euro 2026",
								slug: "world-cup-2026",
								year: 2026,
								status: TournamentStatus.ACTIVE,
								startsAt: new Date("2026-06-11"),
								endsAt: new Date("2026-07-19"),
							},
							source: "explicit" as const,
						};
					},
				),
				getStrictActiveTournament: jest.fn(),
				getActiveTournament: jest.fn(),
				getActiveTournamentMatches: jest.fn(),
				getTournamentMatches: jest.fn(),
			} as unknown as TournamentsService;

			const provider = new MockSportsDataProvider({
				teams: [],
				venues: [],
				fixtures: [],
				finalResults: [
					// Same external match id, different scores — used by both tournaments
					{
						externalMatchId: "fixture-arg-bra",
						homeScore: 3,
						awayScore: 2,
						playedAt: new Date("2026-06-11T19:00:00.000Z"),
					},
				],
			});

			const service = new SportsDataSyncService(
				prisma as unknown as PrismaService,
				createMockFactory(provider),
				createMatchesServiceMock(
					createFinalizeMatchSummary("match-1", "tournament-1"),
				) as unknown as MatchesService,
				tournamentsService,
			);

			// Sync tournament-2 — should stage its own result without affecting tournament-1's staged result
			const result = await service.syncResults("tournament-2");

			expect(result).toMatchObject({ status: "SUCCESS", stagedCount: 1 });

			// Tournament-1's pre-existing result must remain untouched
			expect(state.externalMatchResults).toContainEqual(
				expect.objectContaining({
					id: "existing-result-t1",
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalMatchId: "fixture-arg-bra",
					homeScore: 2,
					awayScore: 1,
					state: "PENDING_CONFIRMATION",
				}),
			);

			// Tournament-2 should have its own newly-staged result with different scores
			const t2Result = state.externalMatchResults.find(
				(r) =>
					r.tournamentId === "tournament-2" &&
					r.externalMatchId === "fixture-arg-bra",
			);
			expect(t2Result).toBeDefined();
			expect(t2Result?.homeScore).toBe(3);
			expect(t2Result?.awayScore).toBe(2);
			expect(t2Result?.matchId).toBe("match-t2");
		});

		it("upserts externalTeamReference when a team already exists in the tournament but has no provider reference yet", async () => {
			// This exercises the branch: team is found by (tournamentId, name) → existingTeam != null
			// → team is updated → externalTeamReference.upsert(...) is called
			const state = createInitialState({
				tournaments: [
					{
						id: "tournament-1",
						slug: "world-cup-2026",
						status: TournamentStatus.ACTIVE,
						providerKey: "mock",
					},
				],
				teams: [
					{
						id: "team-1",
						tournamentId: "tournament-1",
						name: "Argentina",
						shortName: "ARG",
						countryCode: "AR",
						flagCode: "ARG",
						primaryColor: null,
						secondaryColor: null,
					},
				],
				// No externalTeamReference for this team+provider+tournament yet
				externalTeamReferences: [],
			});
			const prisma = createPrismaMock(state);

			const provider = new MockSportsDataProvider({
				teams: [
					{
						externalId: "team-argentina",
						name: "Argentina",
						shortName: "ARG",
						countryCode: "AR",
						flagCode: "ARG",
						primaryColor: "#74ACDF",
						secondaryColor: "#F6E7A1",
						crestUrl: null,
					},
				],
				venues: [],
				fixtures: [],
				finalResults: [],
			});

			const service = new SportsDataSyncService(
				prisma as unknown as PrismaService,
				createMockFactory(provider),
				createMatchesServiceMock(
					createFinalizeMatchSummary("match-1", "tournament-1"),
				) as unknown as MatchesService,
				createTournamentsServiceMock() as unknown as TournamentsService,
			);

			await service.importTournament();

			// The upsert was called with the correct tournament-scoped key
			expect(prisma.externalTeamReference.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						providerKey_tournamentId_teamId: {
							providerKey: "mock",
							tournamentId: "tournament-1",
							teamId: "team-1",
						},
					},
					create: expect.objectContaining({
						providerKey: "mock",
						tournamentId: "tournament-1",
						externalId: "team-argentina",
						teamId: "team-1",
					}),
					update: expect.objectContaining({
						externalId: "team-argentina",
					}),
				}),
			);

			// The reference is now stored
			expect(state.externalTeamReferences).toContainEqual(
				expect.objectContaining({
					providerKey: "mock",
					tournamentId: "tournament-1",
					externalId: "team-argentina",
					teamId: "team-1",
				}),
			);
		});
	});
});
