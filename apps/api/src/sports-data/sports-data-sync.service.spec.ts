import { MatchStatus, TournamentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MOCK_SPORTS_DATA_PROVIDER_SNAPSHOT, MockSportsDataProvider } from './mock-sports-data.provider';
import { SportsDataSyncService } from './sports-data-sync.service';
import type { SportsDataFinalResultDTO } from './sports-data.types';

interface TournamentRecord {
  id: string;
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
  providerKey: string;
  tournamentId: string;
  externalMatchId: string;
  matchId: string | null;
  externalSyncRunId: string | null;
  homeScore: number;
  awayScore: number;
  playedAt: Date | null;
  state: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'DISCARDED';
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
    update: jest.Mock<Promise<SyncRunRecord>, [unknown]>;
  };
  externalMatchResult: {
    upsert: jest.Mock<Promise<ExternalMatchResultRecord>, [unknown]>;
  };
}

function createInitialState(overrides: Partial<PrismaState> = {}): PrismaState {
  return {
    tournaments: [
      {
        id: 'tournament-1',
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
      create: jest.fn(async ({ data }: { data: Omit<SyncRunRecord, 'id' | 'importedCount' | 'updatedCount' | 'stagedCount' | 'skippedCount' | 'errorMessage'> }) => {
        const record: SyncRunRecord = {
          id: `sync-${state.syncRuns.length + 1}`,
          importedCount: 0,
          updatedCount: 0,
          stagedCount: 0,
          skippedCount: 0,
          errorMessage: null,
          ...data,
        };
        state.syncRuns.push(record);
        return record;
      }),
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
      upsert: jest.fn(async ({ where, create, update }: { where: { providerKey_externalMatchId: { providerKey: string; externalMatchId: string } }; create: ExternalMatchResultRecord; update: Partial<ExternalMatchResultRecord> }) => {
        const existing = state.externalMatchResults.find(
          (result) =>
            result.providerKey === where.providerKey_externalMatchId.providerKey &&
            result.externalMatchId === where.providerKey_externalMatchId.externalMatchId,
        );

        if (existing === undefined) {
          const record = { ...create };
          state.externalMatchResults.push(record);
          return record;
        }

        Object.assign(existing, update);
        return existing;
      }),
    },
  } as unknown as PrismaMock;
}

describe('SportsDataSyncService', () => {
  it('imports teams, venues, and fixtures idempotently', async () => {
    const state = createInitialState();
    const prisma = createPrismaMock(state);
    const service = new SportsDataSyncService(prisma as unknown as PrismaService, createProvider());

    const firstRun = await service.importTournament();
    const secondRun = await service.importTournament();

    expect(firstRun.status).toBe('SUCCESS');
    expect(secondRun.status).toBe('SUCCESS');
    expect(state.teams).toHaveLength(4);
    expect(state.venues).toHaveLength(2);
    expect(state.matches).toHaveLength(2);
    expect(state.externalTeamReferences).toHaveLength(4);
    expect(state.externalVenueReferences).toHaveLength(2);
    expect(state.externalMatchReferences).toHaveLength(2);
    expect(state.syncRuns).toHaveLength(2);
  });

  it('records success with zero staged results when the provider has nothing to finalize', async () => {
    const state = createInitialState();
    const prisma = createPrismaMock(state);
    const service = new SportsDataSyncService(prisma as unknown as PrismaService, createProvider());

    const summary = await service.syncResults();

    expect(summary).toMatchObject({
      status: 'SUCCESS',
      stagedCount: 0,
      importedCount: 0,
      updatedCount: 0,
    });
    expect(state.externalMatchResults).toHaveLength(0);
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
    const service = new SportsDataSyncService(prisma as unknown as PrismaService, provider);

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
});
