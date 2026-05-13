import { MatchStatus, TournamentStatus } from '@prisma/client';

import { MatchesService, type FinalizeMatchSummary } from '../matches/matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { MOCK_SPORTS_DATA_PROVIDER_SNAPSHOT, MockSportsDataProvider } from './mock-sports-data.provider';
import { SportsDataSyncService } from './sports-data-sync.service';
import type { SportsDataFinalResultDTO } from './sports-data.types';

interface TournamentRecord {
  id: string;
  slug: string;
  status: TournamentStatus;
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
  state: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'DISCARDED';
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
  syncType: 'IMPORT' | 'RESULTS';
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
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
    create: jest.Mock<Promise<Pick<TeamRecord, 'id'>>, [unknown]>;
    update: jest.Mock<Promise<TeamRecord>, [unknown]>;
  };
  venue: {
    findUnique: jest.Mock<Promise<VenueRecord | null>, [unknown]>;
    create: jest.Mock<Promise<Pick<VenueRecord, 'id'>>, [unknown]>;
    update: jest.Mock<Promise<VenueRecord>, [unknown]>;
  };
  match: {
    findUnique: jest.Mock<Promise<MatchRecord | null>, [unknown]>;
    findFirst: jest.Mock<Promise<MatchRecord | null>, [unknown]>;
    findMany: jest.Mock<Promise<unknown[]>, [unknown]>;
    create: jest.Mock<Promise<Pick<MatchRecord, 'id'>>, [unknown]>;
    update: jest.Mock<Promise<MatchRecord>, [unknown]>;
  };
  externalTeamReference: {
    findUnique: jest.Mock<Promise<ExternalTeamReferenceRecord | null>, [unknown]>;
    create: jest.Mock<Promise<ExternalTeamReferenceRecord>, [unknown]>;
    upsert: jest.Mock<Promise<ExternalTeamReferenceRecord>, [unknown]>;
  };
  externalVenueReference: {
    findUnique: jest.Mock<Promise<ExternalVenueReferenceRecord | null>, [unknown]>;
    create: jest.Mock<Promise<ExternalVenueReferenceRecord>, [unknown]>;
    upsert: jest.Mock<Promise<ExternalVenueReferenceRecord>, [unknown]>;
  };
  externalMatchReference: {
    findUnique: jest.Mock<Promise<ExternalMatchReferenceRecord | null>, [unknown]>;
    create: jest.Mock<Promise<ExternalMatchReferenceRecord>, [unknown]>;
    upsert: jest.Mock<Promise<ExternalMatchReferenceRecord>, [unknown]>;
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
        id: 'tournament-1',
        slug: 'world-cup-2026-demo',
        status: TournamentStatus.ACTIVE,
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

function createProvider(finalResults: readonly SportsDataFinalResultDTO[] = []): MockSportsDataProvider {
  return new MockSportsDataProvider({
    ...MOCK_SPORTS_DATA_PROVIDER_SNAPSHOT,
    finalResults,
  });
}

function createMatchesServiceMock(summary: FinalizeMatchSummary): MatchesServiceMock {
  return {
    finalizeMatch: jest.fn(async (_input: unknown) => summary),
  };
}

function createFinalizeMatchSummary(matchId: string, tournamentId: string): FinalizeMatchSummary {
  return {
    matchId,
    tournamentId,
    scoringSummary: {
      matchId,
      tournamentId,
      scoringRuleId: 'rule-1',
      pendingCount: 2,
      processedCount: 2,
      alreadyScoredCount: 0,
      scoredAt: new Date('2026-05-08T12:00:00.000Z'),
    },
    globalRankingSummary: {
      scope: 'GLOBAL',
      scopeId: 'global',
      tournamentId,
      processedCount: 4,
    },
    groupRankingSummaries: [],
  };
}

function createPrismaMock(state: PrismaState): PrismaMock {
  return {
    tournament: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        state.tournaments.find((tournament) => tournament.id === where.id) ?? null,
      ),
      findFirst: jest.fn(async ({ where }: { where: { status: TournamentStatus } }) =>
        state.tournaments.find((tournament) => tournament.status === where.status) ?? null,
      ),
    },
    team: {
      findUnique: jest.fn(async ({ where }: { where: { tournamentId_name: { tournamentId: string; name: string } } }) =>
        state.teams.find(
          (team) => team.tournamentId === where.tournamentId_name.tournamentId && team.name === where.tournamentId_name.name,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Omit<TeamRecord, 'id'> }) => {
        const record: TeamRecord = { id: `team-${state.teams.length + 1}`, ...data };
        state.teams.push(record);
        return { id: record.id };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Omit<TeamRecord, 'id'>> }) => {
        const team = state.teams.find((candidate) => candidate.id === where.id);

        if (team === undefined) {
          throw new Error(`Missing team ${where.id}`);
        }

        Object.assign(team, data);
        return team;
      }),
    },
    venue: {
      findUnique: jest.fn(async ({ where }: { where: { tournamentId_name: { tournamentId: string; name: string } } }) =>
        state.venues.find(
          (venue) => venue.tournamentId === where.tournamentId_name.tournamentId && venue.name === where.tournamentId_name.name,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Omit<VenueRecord, 'id'> }) => {
        const record: VenueRecord = { id: `venue-${state.venues.length + 1}`, ...data };
        state.venues.push(record);
        return { id: record.id };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Omit<VenueRecord, 'id'>> }) => {
        const venue = state.venues.find((candidate) => candidate.id === where.id);

        if (venue === undefined) {
          throw new Error(`Missing venue ${where.id}`);
        }

        Object.assign(venue, data);
        return venue;
      }),
    },
    match: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => state.matches.find((match) => match.id === where.id) ?? null),
      findFirst: jest.fn(
        async ({ where }: { where: { tournamentId: string; homeTeamId: string; awayTeamId: string; kickoffAt: Date; stage: string | null; groupName: string | null } }) =>
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
      findMany: jest.fn(async ({ where }: { where: { tournamentId: string } }) => {
        const matches = state.matches
          .filter((match) => match.tournamentId === where.tournamentId)
          .slice()
          .sort((left, right) => left.kickoffAt.getTime() - right.kickoffAt.getTime());

        return matches.map((match) => {
          const homeTeam = state.teams.find((team) => team.id === match.homeTeamId);
          const awayTeam = state.teams.find((team) => team.id === match.awayTeamId);
          const externalRefs = state.externalMatchReferences
            .filter((reference) => reference.matchId === match.id && reference.providerKey === 'mock')
            .slice(0, 1)
            .map((reference) => ({ externalId: reference.externalId }));
          const externalResults = state.externalMatchResults
            .filter((result) => result.matchId === match.id && result.providerKey === 'mock')
            .slice()
            .sort((left, right) => (right.stagedAt?.getTime() ?? 0) - (left.stagedAt?.getTime() ?? 0))
            .slice(0, 1)
            .map((result) => ({
              externalMatchId: result.externalMatchId,
              state: result.state,
              homeScore: result.homeScore,
              awayScore: result.awayScore,
              stagedAt: result.stagedAt ?? new Date('2026-05-08T12:00:00.000Z'),
              confirmedAt: result.confirmedAt,
              discardedAt: result.discardedAt,
            }));

          return {
            id: match.id,
            status: match.status,
            kickoffAt: match.kickoffAt,
            stage: match.stage,
            groupName: match.groupName,
            homeTeam: { name: homeTeam?.name ?? '' },
            awayTeam: { name: awayTeam?.name ?? '' },
            externalRefs,
            externalResults,
          };
        });
      }),
      create: jest.fn(async ({ data }: { data: Omit<MatchRecord, 'id'> }) => {
        const record: MatchRecord = { id: `match-${state.matches.length + 1}`, ...data };
        state.matches.push(record);
        return { id: record.id };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Omit<MatchRecord, 'id' | 'tournamentId'>> & { tournamentId?: string } }) => {
        const match = state.matches.find((candidate) => candidate.id === where.id);

        if (match === undefined) {
          throw new Error(`Missing match ${where.id}`);
        }

        Object.assign(match, data);
        return match;
      }),
    },
    externalTeamReference: {
      findUnique: jest.fn(async ({ where }: { where: { providerKey_externalId: { providerKey: string; externalId: string } } }) =>
        state.externalTeamReferences.find(
          (reference) =>
            reference.providerKey === where.providerKey_externalId.providerKey && reference.externalId === where.providerKey_externalId.externalId,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: ExternalTeamReferenceRecord }) => {
        const record = { ...data };
        state.externalTeamReferences.push(record);
        return record;
      }),
      upsert: jest.fn(async ({ where, create, update }: { where: { providerKey_externalId: { providerKey: string; externalId: string } }; create: ExternalTeamReferenceRecord; update: Partial<ExternalTeamReferenceRecord> }) => {
        const existing = state.externalTeamReferences.find(
          (reference) =>
            reference.providerKey === where.providerKey_externalId.providerKey && reference.externalId === where.providerKey_externalId.externalId,
        );

        if (existing === undefined) {
          state.externalTeamReferences.push({ ...create });
          return create;
        }

        Object.assign(existing, update);
        return existing;
      }),
    },
    externalVenueReference: {
      findUnique: jest.fn(async ({ where }: { where: { providerKey_externalId: { providerKey: string; externalId: string } } }) =>
        state.externalVenueReferences.find(
          (reference) =>
            reference.providerKey === where.providerKey_externalId.providerKey && reference.externalId === where.providerKey_externalId.externalId,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: ExternalVenueReferenceRecord }) => {
        const record = { ...data };
        state.externalVenueReferences.push(record);
        return record;
      }),
      upsert: jest.fn(async ({ where, create, update }: { where: { providerKey_externalId: { providerKey: string; externalId: string } }; create: ExternalVenueReferenceRecord; update: Partial<ExternalVenueReferenceRecord> }) => {
        const existing = state.externalVenueReferences.find(
          (reference) =>
            reference.providerKey === where.providerKey_externalId.providerKey && reference.externalId === where.providerKey_externalId.externalId,
        );

        if (existing === undefined) {
          state.externalVenueReferences.push({ ...create });
          return create;
        }

        Object.assign(existing, update);
        return existing;
      }),
    },
    externalMatchReference: {
      findUnique: jest.fn(async ({ where }: { where: { providerKey_externalId: { providerKey: string; externalId: string } } }) =>
        state.externalMatchReferences.find(
          (reference) =>
            reference.providerKey === where.providerKey_externalId.providerKey && reference.externalId === where.providerKey_externalId.externalId,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: ExternalMatchReferenceRecord }) => {
        const record = { ...data };
        state.externalMatchReferences.push(record);
        return record;
      }),
      upsert: jest.fn(async ({ where, create, update }: { where: { providerKey_externalId: { providerKey: string; externalId: string } }; create: ExternalMatchReferenceRecord; update: Partial<ExternalMatchReferenceRecord> }) => {
        const existing = state.externalMatchReferences.find(
          (reference) =>
            reference.providerKey === where.providerKey_externalId.providerKey && reference.externalId === where.providerKey_externalId.externalId,
        );

        if (existing === undefined) {
          state.externalMatchReferences.push({ ...create });
          return create;
        }

        Object.assign(existing, update);
        return existing;
      }),
    },
    externalSyncRun: {
      create: jest.fn(async ({ data }: { data: Omit<SyncRunRecord, 'id' | 'importedCount' | 'updatedCount' | 'stagedCount' | 'skippedCount' | 'errorMessage' | 'startedAt' | 'completedAt'> }) => {
        const record: SyncRunRecord = {
          id: `sync-${state.syncRuns.length + 1}`,
          importedCount: 0,
          updatedCount: 0,
          stagedCount: 0,
          skippedCount: 0,
          errorMessage: null,
          startedAt: new Date('2026-05-08T12:00:00.000Z'),
          completedAt: null,
          ...data,
        };
        state.syncRuns.push(record);
        return record;
      }),
      findMany: jest.fn(async ({ where, take }: { where: { tournamentId: string; providerKey: string }; take: number }) =>
        state.syncRuns
          .filter((run) => run.tournamentId === where.tournamentId && run.providerKey === where.providerKey)
          .slice()
          .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
          .slice(0, take),
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<SyncRunRecord> & { completedAt?: Date | null } }) => {
        const run = state.syncRuns.find((candidate) => candidate.id === where.id);

        if (run === undefined) {
          throw new Error(`Missing sync run ${where.id}`);
        }

        Object.assign(run, data);
        return run;
      }),
    },
    externalMatchResult: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        state.externalMatchResults.find((result) => result.id === where.id) ?? null,
      ),
      findMany: jest.fn(async ({ where }: { where: { state?: ExternalMatchResultRecord['state'] } }) => {
        const filteredResults = state.externalMatchResults
          .filter((result) => where.state === undefined || result.state === where.state)
          .slice()
          .sort((left, right) => (right.stagedAt?.getTime() ?? 0) - (left.stagedAt?.getTime() ?? 0));

        return filteredResults.map((result) => {
          const match = result.matchId ? state.matches.find((candidate) => candidate.id === result.matchId) ?? null : null;
          const homeTeam = match ? state.teams.find((team) => team.id === match.homeTeamId) ?? null : null;
          const awayTeam = match ? state.teams.find((team) => team.id === match.awayTeamId) ?? null : null;

          return {
            ...result,
            stagedAt: result.stagedAt ?? new Date('2026-05-08T12:00:00.000Z'),
            match: match
              ? {
                  id: match.id,
                  status: match.status,
                  kickoffAt: match.kickoffAt,
                  stage: match.stage,
                  groupName: match.groupName,
                  homeTeam: {
                    name: homeTeam?.name ?? '',
                  },
                  awayTeam: {
                    name: awayTeam?.name ?? '',
                  },
                }
              : null,
          };
        });
      }),
      upsert: jest.fn(async ({ where, create, update }: { where: { providerKey_externalMatchId: { providerKey: string; externalMatchId: string } }; create: ExternalMatchResultRecord; update: Partial<ExternalMatchResultRecord> }) => {
        const existing = state.externalMatchResults.find(
          (result) =>
            result.providerKey === where.providerKey_externalMatchId.providerKey &&
            result.externalMatchId === where.providerKey_externalMatchId.externalMatchId,
        );

        if (existing === undefined) {
          const record = {
            ...create,
            id: `external-result-${state.externalMatchResults.length + 1}`,
            stagedAt: create.stagedAt ?? new Date('2026-05-08T12:00:00.000Z'),
            confirmedAt: null,
            discardedAt: null,
          };
          state.externalMatchResults.push(record);
          return record;
        }

        Object.assign(existing, update);
        return existing;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<ExternalMatchResultRecord> }) => {
        const result = state.externalMatchResults.find((candidate) => candidate.id === where.id);

        if (result === undefined) {
          throw new Error(`Missing external result ${where.id}`);
        }

        Object.assign(result, data);
        return result;
      }),
    },
  } as unknown as PrismaMock;
}

describe('SportsDataSyncService', () => {
  it('imports teams, venues, and fixtures idempotently', async () => {
    const state = createInitialState();
    const prisma = createPrismaMock(state);
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1')) as unknown as MatchesService,
    );

    const firstRun = await service.importTournament();
    const secondRun = await service.importTournament();

    expect(firstRun.status).toBe('SUCCESS');
    expect(secondRun.status).toBe('SUCCESS');
    expect(state.teams).toHaveLength(8);
    expect(state.venues).toHaveLength(2);
    expect(state.matches).toHaveLength(4);
    expect(state.externalTeamReferences).toHaveLength(8);
    expect(state.externalVenueReferences).toHaveLength(2);
    expect(state.externalMatchReferences).toHaveLength(4);
    expect(state.syncRuns).toHaveLength(2);
  });

  it('resolves the tournament slug before invoking a football-data provider', async () => {
    const state = createInitialState({
      tournaments: [
        {
          id: 'tournament-db-id',
          slug: 'world-cup-2026-demo',
          status: TournamentStatus.ACTIVE,
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const provider = {
      providerKey: 'football-data',
      listTeams: jest.fn(async () => []),
      listVenues: jest.fn(async () => []),
      listFixtures: jest.fn(async () => []),
      listFinalResults: jest.fn(async () => []),
    };
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      provider as unknown as MockSportsDataProvider,
      createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-db-id')) as unknown as MatchesService,
    );

    await service.importTournament('tournament-db-id');

    expect(provider.listTeams).toHaveBeenCalledWith('world-cup-2026-demo');
    expect(provider.listVenues).toHaveBeenCalledWith('world-cup-2026-demo');
    expect(provider.listFixtures).toHaveBeenCalledWith('world-cup-2026-demo');
  });

  it('records success with zero staged results when the provider has nothing to finalize', async () => {
    const state = createInitialState();
    const prisma = createPrismaMock(state);
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1')) as unknown as MatchesService,
    );

    const summary = await service.syncResults();

    expect(summary).toMatchObject({
      status: 'SUCCESS',
      stagedCount: 0,
      importedCount: 0,
      updatedCount: 0,
    });
    expect(state.externalMatchResults).toHaveLength(0);
  });

  it('lists pending staged results with linked match context', async () => {
    const state = createInitialState({
      teams: [
        {
          id: 'team-1',
          tournamentId: 'tournament-1',
          name: 'Argentina',
          shortName: 'ARG',
          countryCode: 'AR',
          flagCode: 'ARG',
          primaryColor: '#74ACDF',
          secondaryColor: '#F6E7A1',
        },
        {
          id: 'team-2',
          tournamentId: 'tournament-1',
          name: 'England',
          shortName: 'ENG',
          countryCode: 'GB-ENG',
          flagCode: 'ENG',
          primaryColor: '#FFFFFF',
          secondaryColor: '#CE1124',
        },
      ],
      matches: [
        {
          id: 'match-1',
          tournamentId: 'tournament-1',
          homeTeamId: 'team-1',
          awayTeamId: 'team-2',
          venueId: null,
          kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
          stage: 'Group Stage',
          groupName: 'Group A',
          status: MatchStatus.UPCOMING,
        },
      ],
      externalMatchResults: [
        {
          id: 'external-result-1',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalMatchId: 'fixture-arg-eng',
          matchId: 'match-1',
          externalSyncRunId: 'sync-1',
          homeScore: 2,
          awayScore: 1,
          playedAt: new Date('2026-06-11T19:00:00.000Z'),
          stagedAt: new Date('2026-06-11T20:00:00.000Z'),
          state: 'PENDING_CONFIRMATION',
          confirmedAt: null,
          discardedAt: null,
        },
        {
          id: 'external-result-2',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalMatchId: 'fixture-arg-mex',
          matchId: null,
          externalSyncRunId: 'sync-1',
          homeScore: 0,
          awayScore: 0,
          playedAt: null,
          stagedAt: new Date('2026-06-11T21:00:00.000Z'),
          state: 'CONFIRMED',
          confirmedAt: new Date('2026-06-11T21:05:00.000Z'),
          discardedAt: null,
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1')) as unknown as MatchesService,
    );

    const results = await service.listExternalMatchResults();

    expect(results).toEqual([
      {
        id: 'external-result-1',
        providerKey: 'mock',
        externalMatchId: 'fixture-arg-eng',
        matchId: 'match-1',
        state: 'PENDING_CONFIRMATION',
        homeScore: 2,
        awayScore: 1,
        playedAt: new Date('2026-06-11T19:00:00.000Z'),
        stagedAt: new Date('2026-06-11T20:00:00.000Z'),
        confirmedAt: null,
        discardedAt: null,
        match: {
          matchId: 'match-1',
          status: MatchStatus.UPCOMING,
          kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
          homeTeamName: 'Argentina',
          awayTeamName: 'England',
          stage: 'Group Stage',
          groupName: 'Group A',
        },
      },
    ]);
    expect(prisma.externalMatchResult.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { state: 'PENDING_CONFIRMATION' },
        orderBy: { stagedAt: 'desc' },
      }),
    );
  });

  it('lists external mapping diagnostics for active tournament matches', async () => {
    const state = createInitialState({
      teams: [
        {
          id: 'team-1',
          tournamentId: 'tournament-1',
          name: 'Argentina',
          shortName: 'ARG',
          countryCode: 'AR',
          flagCode: 'ARG',
          primaryColor: null,
          secondaryColor: null,
        },
        {
          id: 'team-2',
          tournamentId: 'tournament-1',
          name: 'England',
          shortName: 'ENG',
          countryCode: 'GB-ENG',
          flagCode: 'ENG',
          primaryColor: null,
          secondaryColor: null,
        },
      ],
      matches: [
        {
          id: 'match-1',
          tournamentId: 'tournament-1',
          homeTeamId: 'team-1',
          awayTeamId: 'team-2',
          venueId: null,
          kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
          stage: 'Group Stage',
          groupName: 'Group A',
          status: MatchStatus.UPCOMING,
        },
      ],
      externalMatchReferences: [
        {
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalId: 'fixture-arg-eng',
          matchId: 'match-1',
        },
      ],
      externalMatchResults: [
        {
          id: 'external-result-1',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalMatchId: 'fixture-arg-eng',
          matchId: 'match-1',
          externalSyncRunId: 'sync-1',
          homeScore: 2,
          awayScore: 1,
          playedAt: new Date('2026-06-11T19:00:00.000Z'),
          stagedAt: new Date('2026-06-11T20:00:00.000Z'),
          state: 'PENDING_CONFIRMATION',
          confirmedAt: null,
          discardedAt: null,
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1')) as unknown as MatchesService,
    );

    const diagnostics = await service.listExternalMatchMappingDiagnostics();

    expect(diagnostics).toEqual([
      {
        matchId: 'match-1',
        status: MatchStatus.UPCOMING,
        kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
        homeTeamName: 'Argentina',
        awayTeamName: 'England',
        stage: 'Group Stage',
        groupName: 'Group A',
        externalMatchId: 'fixture-arg-eng',
        hasExternalReference: true,
        latestExternalResult: {
          externalMatchId: 'fixture-arg-eng',
          state: 'PENDING_CONFIRMATION',
          homeScore: 2,
          awayScore: 1,
          stagedAt: new Date('2026-06-11T20:00:00.000Z'),
          confirmedAt: null,
          discardedAt: null,
        },
      },
    ]);
  });

  it('lists recent sync runs for the active tournament and provider', async () => {
    const state = createInitialState({
      syncRuns: [
        {
          id: 'sync-1',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          syncType: 'IMPORT',
          status: 'SUCCESS',
          importedCount: 14,
          updatedCount: 0,
          stagedCount: 0,
          skippedCount: 0,
          errorMessage: null,
          startedAt: new Date('2026-05-08T12:00:00.000Z'),
          completedAt: new Date('2026-05-08T12:01:00.000Z'),
        },
        {
          id: 'sync-2',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          syncType: 'RESULTS',
          status: 'SUCCESS',
          importedCount: 0,
          updatedCount: 0,
          stagedCount: 4,
          skippedCount: 0,
          errorMessage: null,
          startedAt: new Date('2026-05-08T13:00:00.000Z'),
          completedAt: new Date('2026-05-08T13:01:00.000Z'),
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1')) as unknown as MatchesService,
    );

    const syncRuns = await service.listRecentSyncRuns();

    expect(syncRuns).toEqual([
      {
        syncRunId: 'sync-2',
        providerKey: 'mock',
        tournamentId: 'tournament-1',
        syncType: 'RESULTS',
        status: 'SUCCESS',
        importedCount: 0,
        updatedCount: 0,
        stagedCount: 4,
        skippedCount: 0,
        errorMessage: null,
        startedAt: new Date('2026-05-08T13:00:00.000Z'),
        completedAt: new Date('2026-05-08T13:01:00.000Z'),
      },
      {
        syncRunId: 'sync-1',
        providerKey: 'mock',
        tournamentId: 'tournament-1',
        syncType: 'IMPORT',
        status: 'SUCCESS',
        importedCount: 14,
        updatedCount: 0,
        stagedCount: 0,
        skippedCount: 0,
        errorMessage: null,
        startedAt: new Date('2026-05-08T12:00:00.000Z'),
        completedAt: new Date('2026-05-08T12:01:00.000Z'),
      },
    ]);
    expect(prisma.externalSyncRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tournamentId: 'tournament-1', providerKey: 'mock' },
        orderBy: { startedAt: 'desc' },
        take: 6,
      }),
    );
  });

  it('stages final results idempotently without invoking match finalization', async () => {
    const state = createInitialState({
      matches: [
        {
          id: 'match-1',
          tournamentId: 'tournament-1',
          homeTeamId: 'team-1',
          awayTeamId: 'team-2',
          venueId: null,
          kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
          stage: 'Group Stage',
          groupName: 'Group A',
          status: MatchStatus.UPCOMING,
        },
      ],
      externalMatchReferences: [
        {
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalId: 'fixture-arg-eng',
          matchId: 'match-1',
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const provider = createProvider([
      {
        externalMatchId: 'fixture-arg-eng',
        homeScore: 2,
        awayScore: 1,
        playedAt: new Date('2026-06-11T19:00:00.000Z'),
      },
    ]);
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      provider,
      createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1')) as unknown as MatchesService,
    );

    const firstRun = await service.syncResults();
    const secondRun = await service.syncResults();

    expect(firstRun).toMatchObject({ status: 'SUCCESS', stagedCount: 1 });
    expect(secondRun).toMatchObject({ status: 'SUCCESS', stagedCount: 1 });
    expect(state.externalMatchResults).toHaveLength(1);
    expect(state.externalMatchResults[0]).toMatchObject({
      externalMatchId: 'fixture-arg-eng',
      matchId: 'match-1',
      homeScore: 2,
      awayScore: 1,
      state: 'PENDING_CONFIRMATION',
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it('confirms a pending staged result by finalizing the linked match', async () => {
    const state = createInitialState({
      matches: [
        {
          id: 'match-1',
          tournamentId: 'tournament-1',
          homeTeamId: 'team-1',
          awayTeamId: 'team-2',
          venueId: null,
          kickoffAt: new Date('2026-06-11T16:00:00.000Z'),
          stage: 'Group Stage',
          groupName: 'Group A',
          status: MatchStatus.UPCOMING,
        },
      ],
      externalMatchResults: [
        {
          id: 'external-result-1',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalMatchId: 'fixture-arg-eng',
          matchId: 'match-1',
          externalSyncRunId: 'sync-1',
          homeScore: 2,
          awayScore: 1,
          playedAt: new Date('2026-06-11T19:00:00.000Z'),
          state: 'PENDING_CONFIRMATION',
          confirmedAt: null,
          discardedAt: null,
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const finalizeSummary = createFinalizeMatchSummary('match-1', 'tournament-1');
    const matchesService = createMatchesServiceMock(finalizeSummary);
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      matchesService as unknown as MatchesService,
    );

    const summary = await service.confirmExternalMatchResult({ externalMatchResultId: 'external-result-1' });

    expect(summary).toMatchObject({
      externalMatchResultId: 'external-result-1',
      externalMatchId: 'fixture-arg-eng',
      matchId: 'match-1',
      tournamentId: 'tournament-1',
      state: 'CONFIRMED',
      finalizationSummary: finalizeSummary,
    });
    expect(matchesService.finalizeMatch).toHaveBeenCalledWith({
      matchId: 'match-1',
      homeScore: 2,
      awayScore: 1,
    });
    expect(state.externalMatchResults[0]).toMatchObject({
      state: 'CONFIRMED',
      confirmedAt: expect.any(Date),
      discardedAt: null,
    });
  });

  it('discards a pending staged result without finalizing the linked match', async () => {
    const state = createInitialState({
      externalMatchResults: [
        {
          id: 'external-result-1',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalMatchId: 'fixture-arg-eng',
          matchId: 'match-1',
          externalSyncRunId: 'sync-1',
          homeScore: 2,
          awayScore: 1,
          playedAt: new Date('2026-06-11T19:00:00.000Z'),
          state: 'PENDING_CONFIRMATION',
          confirmedAt: null,
          discardedAt: null,
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const matchesService = createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1'));
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      matchesService as unknown as MatchesService,
    );

    const summary = await service.discardExternalMatchResult({ externalMatchResultId: 'external-result-1' });

    expect(summary).toMatchObject({
      externalMatchResultId: 'external-result-1',
      externalMatchId: 'fixture-arg-eng',
      matchId: 'match-1',
      tournamentId: 'tournament-1',
      state: 'DISCARDED',
    });
    expect(matchesService.finalizeMatch).not.toHaveBeenCalled();
    expect(state.externalMatchResults[0]).toMatchObject({
      state: 'DISCARDED',
      confirmedAt: null,
      discardedAt: expect.any(Date),
    });
  });

  it('rejects a staged result without a linked internal match', async () => {
    const state = createInitialState({
      externalMatchResults: [
        {
          id: 'external-result-1',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalMatchId: 'fixture-arg-eng',
          matchId: null,
          externalSyncRunId: 'sync-1',
          homeScore: 2,
          awayScore: 1,
          playedAt: new Date('2026-06-11T19:00:00.000Z'),
          state: 'PENDING_CONFIRMATION',
          confirmedAt: null,
          discardedAt: null,
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const matchesService = createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1'));
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      matchesService as unknown as MatchesService,
    );

    await expect(service.confirmExternalMatchResult({ externalMatchResultId: 'external-result-1' })).rejects.toThrow(
      'is not linked to an internal match',
    );
    expect(matchesService.finalizeMatch).not.toHaveBeenCalled();
  });

  it('rejects an already confirmed staged result', async () => {
    const state = createInitialState({
      externalMatchResults: [
        {
          id: 'external-result-1',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalMatchId: 'fixture-arg-eng',
          matchId: 'match-1',
          externalSyncRunId: 'sync-1',
          homeScore: 2,
          awayScore: 1,
          playedAt: new Date('2026-06-11T19:00:00.000Z'),
          state: 'CONFIRMED',
          confirmedAt: new Date('2026-06-11T20:00:00.000Z'),
          discardedAt: null,
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const matchesService = createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1'));
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      matchesService as unknown as MatchesService,
    );

    await expect(service.confirmExternalMatchResult({ externalMatchResultId: 'external-result-1' })).rejects.toThrow(
      'already confirmed',
    );
    expect(matchesService.finalizeMatch).not.toHaveBeenCalled();
  });

  it('rejects an already discarded staged result', async () => {
    const state = createInitialState({
      externalMatchResults: [
        {
          id: 'external-result-1',
          providerKey: 'mock',
          tournamentId: 'tournament-1',
          externalMatchId: 'fixture-arg-eng',
          matchId: 'match-1',
          externalSyncRunId: 'sync-1',
          homeScore: 2,
          awayScore: 1,
          playedAt: new Date('2026-06-11T19:00:00.000Z'),
          state: 'DISCARDED',
          confirmedAt: null,
          discardedAt: new Date('2026-06-11T20:00:00.000Z'),
        },
      ],
    });
    const prisma = createPrismaMock(state);
    const matchesService = createMatchesServiceMock(createFinalizeMatchSummary('match-1', 'tournament-1'));
    const service = new SportsDataSyncService(
      prisma as unknown as PrismaService,
      createProvider(),
      matchesService as unknown as MatchesService,
    );

    await expect(service.discardExternalMatchResult({ externalMatchResultId: 'external-result-1' })).rejects.toThrow(
      'already discarded',
    );
    expect(matchesService.finalizeMatch).not.toHaveBeenCalled();
  });
});
