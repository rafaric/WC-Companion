import { PredictionScoringStatus, RankingScope, type GroupMembership, type Prediction, type ScoringRule } from '@prisma/client';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { TournamentsService } from '../tournaments/tournaments.service';
import type { UsersService } from '../users/users.service';
import { RankingsService, type RankingEntryView, type RankingRecalculationSummary } from './rankings.service';

interface ScoringRuleFindFirstArgs {
  where: {
    tournamentId: string;
    isActive: boolean;
  };
  select: {
    exactScore: boolean;
  };
}

interface PredictionFindManyArgs {
  where: {
    tournamentId: string;
    scoringStatus: PredictionScoringStatus;
    userId?: {
      in: string[];
    };
  };
  select: {
    userId: boolean;
    pointsAwarded: boolean;
    scoredAt: boolean;
  };
}

interface GroupMembershipFindManyArgs {
  where: {
    groupId: string;
  };
  select: {
    userId: boolean;
  };
}

interface RankingEntryUpsertArgs {
  where: {
    tournamentId_scope_scopeId_userId: {
      tournamentId: string;
      scope: RankingScope;
      scopeId: string;
      userId: string;
    };
  };
  create: RankingEntryRecord;
  update: Omit<RankingEntryRecord, 'id' | 'tournamentId' | 'scope' | 'scopeId' | 'userId'>;
}

interface RankingEntryDeleteManyArgs {
  where: {
    tournamentId: string;
    scope: RankingScope;
    scopeId: string;
    userId?: {
      notIn: string[];
    };
  };
}

interface RankingEntryFindManyArgs {
  where: {
    tournamentId: string;
    scope: RankingScope;
    scopeId: string;
  };
  orderBy: Array<{
    position?: 'asc' | 'desc';
    totalPoints?: 'asc' | 'desc';
    userId?: 'asc' | 'desc';
  }>;
  select: {
    position: boolean;
    userId: boolean;
    totalPoints: boolean;
    exactPredictions: boolean;
    predictionsCount: boolean;
    lastScoredAt: boolean;
    updatedAt: boolean;
    user: {
      select: {
        username: boolean;
        avatar: boolean;
        country: boolean;
        favoriteTeamId: boolean;
      };
    };
  };
}

interface PredictionRecord extends Pick<Prediction, 'tournamentId' | 'userId' | 'pointsAwarded' | 'scoringStatus' | 'scoredAt'> {}

interface GroupMembershipRecord extends Pick<GroupMembership, 'groupId' | 'userId'> {}

interface ScoringRuleRecord extends Pick<ScoringRule, 'tournamentId' | 'exactScore' | 'isActive'> {}

interface RankingEntryRecord {
  id: string;
  tournamentId: string;
  userId: string;
  scope: RankingScope;
  scopeId: string;
  position: number;
  totalPoints: number;
  exactPredictions: number;
  predictionsCount: number;
  lastScoredAt: Date | null;
  updatedAt: Date;
  user?: {
    username: string;
    avatar: string | null;
    country: string | null;
    favoriteTeamId: string | null;
  };
}

interface RankingEntryViewRecord extends Omit<RankingEntryRecord, 'id' | 'tournamentId' | 'scope' | 'scopeId' | 'user'> {
  user: {
    username: string;
    avatar: string | null;
    country: string | null;
    favoriteTeamId: string | null;
  };
}

interface PrismaMockState {
  predictions: PredictionRecord[];
  groupMemberships: GroupMembershipRecord[];
  groups?: Array<{ id: string; tournamentId: string }>;
  scoringRules: ScoringRuleRecord[];
  rankingEntries: RankingEntryRecord[];
}

interface PrismaMock {
  prediction: {
    findMany: jest.Mock<Promise<Array<Pick<PredictionRecord, 'userId' | 'pointsAwarded' | 'scoredAt'>>>, [PredictionFindManyArgs]>;
  };
  groupMembership: {
    findMany: jest.Mock<Promise<Array<Pick<GroupMembershipRecord, 'userId'>>>, [GroupMembershipFindManyArgs]>;
    findFirst: jest.Mock<Promise<{ userId: string } | null>, [{ where: { groupId: string; userId: string }; select: { userId: boolean } }]>
  };
  scoringRule: {
    findFirst: jest.Mock<Promise<Pick<ScoringRuleRecord, 'exactScore'> | null>, [ScoringRuleFindFirstArgs]>;
  };
  rankingEntry: {
    deleteMany: jest.Mock<Promise<{ count: number }>, [RankingEntryDeleteManyArgs]>;
    upsert: jest.Mock<Promise<RankingEntryRecord>, [RankingEntryUpsertArgs]>;
    findMany: jest.Mock<Promise<RankingEntryViewRecord[]>, [RankingEntryFindManyArgs]>;
  };
  group: {
    findFirst: jest.Mock<Promise<{ tournamentId: string } | null>, [{ where: { id: string }; select: { tournamentId: boolean } }]>
  };
  $transaction: <T>(callback: (transaction: PrismaMock) => Promise<T>) => Promise<T>;
}

interface UsersServiceMock {
  syncAuthenticatedUser: jest.Mock<Promise<{ id: string }>, [AuthenticatedIdentity]>;
}

interface TournamentsServiceMock {
  getActiveTournament: jest.Mock<Promise<{ id: string }>, []>;
  resolveTournamentContext: jest.Mock<Promise<{ tournament: { id: string; name: string; slug: string; year: number; status: string; startsAt: Date | null; endsAt: Date | null }; source: 'explicit' | 'cookie' | 'active' }>, any[]>;
}

function createScoredPrediction(overrides: Partial<PredictionRecord> & { scoredAt: Date }): PredictionRecord {
  return {
    tournamentId: 'tournament-1',
    userId: 'user-1',
    pointsAwarded: 0,
    scoringStatus: PredictionScoringStatus.SCORED,
    ...overrides,
  };
}

function createScoringRule(overrides: Partial<ScoringRuleRecord> = {}): ScoringRuleRecord {
  return {
    tournamentId: 'tournament-1',
    exactScore: 3,
    isActive: true,
    ...overrides,
  };
}

function createGroupMembership(overrides: Partial<GroupMembershipRecord> = {}): GroupMembershipRecord {
  return {
    groupId: 'group-1',
    userId: 'user-1',
    ...overrides,
  };
}

function createRankingEntry(overrides: Partial<RankingEntryRecord> = {}): RankingEntryRecord {
  return {
    id: 'ranking-entry-1',
    tournamentId: 'tournament-1',
    userId: 'user-1',
    scope: RankingScope.GLOBAL,
    scopeId: 'global',
    position: 1,
    totalPoints: 0,
    exactPredictions: 0,
    predictionsCount: 0,
    lastScoredAt: null,
    updatedAt: new Date('2026-05-08T00:00:00.000Z'),
    ...overrides,
  };
}

function createPrismaMock(state: PrismaMockState): PrismaMock {
  let prisma: PrismaMock;

  const $transaction: PrismaMock['$transaction'] = async <T>(callback: (transaction: PrismaMock) => Promise<T>): Promise<T> => callback(prisma);

  prisma = {
    prediction: {
      findMany: jest.fn(async ({ where }) =>
        state.predictions
          .filter((prediction) => prediction.tournamentId === where.tournamentId && prediction.scoringStatus === where.scoringStatus)
          .filter((prediction) => where.userId === undefined || where.userId.in.includes(prediction.userId))
          .map((prediction) => ({
            userId: prediction.userId,
            pointsAwarded: prediction.pointsAwarded,
            scoredAt: prediction.scoredAt,
          })),
      ),
    },
    groupMembership: {
      findMany: jest.fn(async ({ where }) =>
        state.groupMemberships
          .filter((membership) => membership.groupId === where.groupId)
          .map((membership) => ({ userId: membership.userId })),
      ),
      findFirst: jest.fn(async ({ where }) =>
        state.groupMemberships.find((membership) => membership.groupId === where.groupId && membership.userId === where.userId) ?? null,
      ),
    },
    scoringRule: {
      findFirst: jest.fn(async ({ where }) =>
        state.scoringRules.find((rule) => rule.tournamentId === where.tournamentId && rule.isActive === where.isActive) ?? null,
      ),
    },
    rankingEntry: {
      deleteMany: jest.fn(async ({ where }) => {
        const beforeCount = state.rankingEntries.length;
        const excludedUserIds = where.userId?.notIn;

        state.rankingEntries = state.rankingEntries.filter((entry) => {
          if (entry.tournamentId !== where.tournamentId || entry.scope !== where.scope || entry.scopeId !== where.scopeId) {
            return true;
          }

          if (excludedUserIds === undefined) {
            return false;
          }

          return excludedUserIds.includes(entry.userId);
        });

        return { count: beforeCount - state.rankingEntries.length };
      }),
      upsert: jest.fn(async ({ where, create, update }) => {
        const unique = where.tournamentId_scope_scopeId_userId;
        const existingIndex = state.rankingEntries.findIndex(
          (entry) =>
            entry.tournamentId === unique.tournamentId &&
            entry.scope === unique.scope &&
            entry.scopeId === unique.scopeId &&
            entry.userId === unique.userId,
        );

        if (existingIndex >= 0) {
          const existing = state.rankingEntries[existingIndex];

          if (existing === undefined) {
            throw new Error('Expected ranking entry to exist');
          }

          const updated: RankingEntryRecord = {
            id: existing.id,
            tournamentId: existing.tournamentId,
            userId: existing.userId,
            scope: existing.scope,
            scopeId: existing.scopeId,
            ...update,
            lastScoredAt: update.lastScoredAt,
            updatedAt: existing.updatedAt,
          };

          state.rankingEntries[existingIndex] = updated;
          return updated;
        }

        const created: RankingEntryRecord = {
          ...create,
          id: `ranking-entry-${create.userId}`,
          updatedAt: create.updatedAt,
        };

        state.rankingEntries.push(created);
        return created;
      }),
      findMany: jest.fn(async ({ where }) =>
        state.rankingEntries
          .filter(
            (entry) => entry.tournamentId === where.tournamentId && entry.scope === where.scope && entry.scopeId === where.scopeId,
          )
          .slice()
          .sort((left, right) => left.position - right.position || right.totalPoints - left.totalPoints || left.userId.localeCompare(right.userId))
          .map((entry) => ({
            ...entry,
            user:
              entry.user ??
              {
                username: `user-${entry.userId}`,
                avatar: null,
                country: null,
                favoriteTeamId: null,
              },
          })),
      ),
    },
    group: {
      findFirst: jest.fn(async ({ where }) => {
        return state.groups?.find((group) => group.id === where.id) ?? null;
      }),
    },
    $transaction,
  };

  return prisma;
}

function createUsersServiceMock(userId = 'user-1'): UsersServiceMock {
  return {
    syncAuthenticatedUser: jest.fn(async (_identity: AuthenticatedIdentity) => ({ id: userId })),
  };
}

function createTournamentsServiceMock(tournamentId = 'tournament-1'): TournamentsServiceMock {
  return {
    getActiveTournament: jest.fn(async () => ({ id: tournamentId })),
    resolveTournamentContext: jest.fn(async () => ({
      tournament: { id: tournamentId, name: 'Test Tournament', slug: 'test-tournament', year: 2026, status: 'ACTIVE' as const, startsAt: null, endsAt: null },
      source: 'active' as const,
    })),
  };
}

function createIdentity(overrides: Partial<AuthenticatedIdentity> = {}): AuthenticatedIdentity {
  return {
    authSubject: 'auth0|123456789',
    email: 'messi@example.com',
    name: 'Lionel Messi',
    nickname: 'messi',
    picture: null,
    permissions: [],
    ...overrides,
  };
}

function createRankingService(
  prisma: PrismaMock,
  usersService: UsersServiceMock = createUsersServiceMock(),
  tournamentsService: TournamentsServiceMock = createTournamentsServiceMock(),
): RankingsService {
  return new RankingsService(
    prisma as unknown as PrismaService,
    usersService as unknown as UsersService,
    tournamentsService as unknown as TournamentsService,
  );
}

describe('RankingsService', () => {
  it('recalculates the global ranking with dense positions', async () => {
    const state: PrismaMockState = {
      predictions: [
        createScoredPrediction({ userId: 'user-alpha', pointsAwarded: 3, scoredAt: new Date('2026-05-08T09:00:00.000Z') }),
        createScoredPrediction({ userId: 'user-alpha', pointsAwarded: 3, scoredAt: new Date('2026-05-08T10:00:00.000Z') }),
        createScoredPrediction({ userId: 'user-alpha', pointsAwarded: 3, scoredAt: new Date('2026-05-08T11:00:00.000Z') }),
        createScoredPrediction({ userId: 'user-alpha', pointsAwarded: 3, scoredAt: new Date('2026-05-08T12:00:00.000Z') }),
        createScoredPrediction({ userId: 'user-bravo', pointsAwarded: 3, scoredAt: new Date('2026-05-08T08:00:00.000Z') }),
        createScoredPrediction({ userId: 'user-bravo', pointsAwarded: 3, scoredAt: new Date('2026-05-08T08:30:00.000Z') }),
        createScoredPrediction({ userId: 'user-bravo', pointsAwarded: 2, scoredAt: new Date('2026-05-08T08:45:00.000Z') }),
        createScoredPrediction({ userId: 'user-bravo', pointsAwarded: 2, scoredAt: new Date('2026-05-08T08:55:00.000Z') }),
        createScoredPrediction({ userId: 'user-charlie', pointsAwarded: 3, scoredAt: new Date('2026-05-08T08:10:00.000Z') }),
        createScoredPrediction({ userId: 'user-charlie', pointsAwarded: 3, scoredAt: new Date('2026-05-08T08:20:00.000Z') }),
        createScoredPrediction({ userId: 'user-charlie', pointsAwarded: 2, scoredAt: new Date('2026-05-08T09:10:00.000Z') }),
        createScoredPrediction({ userId: 'user-charlie', pointsAwarded: 2, scoredAt: new Date('2026-05-08T11:00:00.000Z') }),
        createScoredPrediction({ userId: 'user-delta', pointsAwarded: 3, scoredAt: new Date('2026-05-08T07:00:00.000Z') }),
        createScoredPrediction({ userId: 'user-delta', pointsAwarded: 1, scoredAt: new Date('2026-05-08T07:30:00.000Z') }),
      ],
      groupMemberships: [],
      scoringRules: [createScoringRule()],
      rankingEntries: [],
    };
    const prisma = createPrismaMock(state);
    const service = createRankingService(prisma);

    const summary: RankingRecalculationSummary = await service.recalculateGlobalRanking('tournament-1');

    expect(summary).toEqual({
      scope: RankingScope.GLOBAL,
      scopeId: 'global',
      tournamentId: 'tournament-1',
      processedCount: 4,
    });
    expect(state.rankingEntries.map(({ userId, position }) => ({ userId, position }))).toEqual([
      { userId: 'user-alpha', position: 1 },
      { userId: 'user-bravo', position: 2 },
      { userId: 'user-charlie', position: 2 },
      { userId: 'user-delta', position: 3 },
    ]);
    expect(state.rankingEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'user-alpha', totalPoints: 12, exactPredictions: 4, predictionsCount: 4 }),
        expect.objectContaining({ userId: 'user-bravo', totalPoints: 10, exactPredictions: 2, predictionsCount: 4 }),
        expect.objectContaining({ userId: 'user-charlie', totalPoints: 10, exactPredictions: 2, predictionsCount: 4 }),
        expect.objectContaining({ userId: 'user-delta', totalPoints: 4, exactPredictions: 1, predictionsCount: 2 }),
      ]),
    );
    expect(state.rankingEntries[1]?.lastScoredAt?.toISOString()).toBe('2026-05-08T08:55:00.000Z');
    expect(state.rankingEntries[2]?.lastScoredAt?.toISOString()).toBe('2026-05-08T11:00:00.000Z');
  });

  it('uses userId as the final stable tie-breaker without changing the dense position', async () => {
    const tieBreakAt = new Date('2026-05-08T10:00:00.000Z');
    const state: PrismaMockState = {
      predictions: [
        createScoredPrediction({ userId: 'user-b', pointsAwarded: 3, scoredAt: tieBreakAt }),
        createScoredPrediction({ userId: 'user-b', pointsAwarded: 3, scoredAt: tieBreakAt }),
        createScoredPrediction({ userId: 'user-b', pointsAwarded: 2, scoredAt: tieBreakAt }),
        createScoredPrediction({ userId: 'user-a', pointsAwarded: 3, scoredAt: tieBreakAt }),
        createScoredPrediction({ userId: 'user-a', pointsAwarded: 3, scoredAt: tieBreakAt }),
        createScoredPrediction({ userId: 'user-a', pointsAwarded: 2, scoredAt: tieBreakAt }),
      ],
      groupMemberships: [],
      scoringRules: [createScoringRule()],
      rankingEntries: [],
    };
    const prisma = createPrismaMock(state);
    const service = createRankingService(prisma);

    await service.recalculateGlobalRanking('tournament-1');

    expect(state.rankingEntries.map(({ userId, position }) => ({ userId, position }))).toEqual([
      { userId: 'user-a', position: 1 },
      { userId: 'user-b', position: 1 },
    ]);
  });

  it('recalculates group ranking only for group members', async () => {
    const state: PrismaMockState = {
      predictions: [
        createScoredPrediction({ userId: 'member-1', pointsAwarded: 3, scoredAt: new Date('2026-05-08T10:00:00.000Z') }),
        createScoredPrediction({ userId: 'member-2', pointsAwarded: 2, scoredAt: new Date('2026-05-08T11:00:00.000Z') }),
        createScoredPrediction({ userId: 'non-member', pointsAwarded: 3, scoredAt: new Date('2026-05-08T12:00:00.000Z') }),
      ],
      groupMemberships: [
        createGroupMembership({ groupId: 'group-1', userId: 'member-1' }),
        createGroupMembership({ groupId: 'group-1', userId: 'member-2' }),
      ],
      scoringRules: [createScoringRule()],
      rankingEntries: [],
    };
    const prisma = createPrismaMock(state);
    const service = createRankingService(prisma);

    const summary = await service.recalculateGroupRanking('tournament-1', 'group-1');

    expect(summary).toEqual({
      scope: RankingScope.GROUP,
      scopeId: 'group-1',
      tournamentId: 'tournament-1',
      processedCount: 2,
    });
    expect(state.rankingEntries.map(({ userId }) => userId)).toEqual(['member-1', 'member-2']);
    expect(state.rankingEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'member-1', totalPoints: 3, exactPredictions: 1, predictionsCount: 1 }),
        expect.objectContaining({ userId: 'member-2', totalPoints: 2, exactPredictions: 0, predictionsCount: 1 }),
      ]),
    );
  });

  it('returns zero processed and clears stale rows when there are no scored predictions', async () => {
    const state: PrismaMockState = {
      predictions: [],
      groupMemberships: [],
      scoringRules: [],
      rankingEntries: [createRankingEntry({ userId: 'stale-user', scope: RankingScope.GLOBAL, scopeId: 'global', position: 9 })],
    };
    const prisma = createPrismaMock(state);
    const service = createRankingService(prisma);

    const summary = await service.recalculateGlobalRanking('tournament-1');

    expect(summary).toEqual({
      scope: RankingScope.GLOBAL,
      scopeId: 'global',
      tournamentId: 'tournament-1',
      processedCount: 0,
    });
    expect(state.rankingEntries).toEqual([]);
  });

  it('returns the active global ranking ordered by position', async () => {
    const state: PrismaMockState = {
      predictions: [],
      groupMemberships: [],
      groups: [],
      scoringRules: [],
      rankingEntries: [
        createRankingEntry({
          userId: 'user-b',
          position: 2,
          totalPoints: 8,
          exactPredictions: 1,
          predictionsCount: 4,
          user: {
            username: 'bravo',
            avatar: 'avatar-b',
            country: 'AR',
            favoriteTeamId: 'team-2',
          },
        }),
        createRankingEntry({
          userId: 'user-a',
          position: 1,
          totalPoints: 10,
          exactPredictions: 2,
          predictionsCount: 4,
          user: {
            username: 'alpha',
            avatar: 'avatar-a',
            country: 'BR',
            favoriteTeamId: 'team-1',
          },
        }),
      ],
    };
    const service = createRankingService(createPrismaMock(state), createUsersServiceMock(), createTournamentsServiceMock());

    const ranking = await service.getActiveGlobalRanking();

    expect(ranking).toEqual<RankingEntryView[]>([
      {
        position: 1,
        userId: 'user-a',
        username: 'alpha',
        avatar: 'avatar-a',
        country: 'BR',
        favoriteTeamId: 'team-1',
        totalPoints: 10,
        exactPredictions: 2,
        predictionsCount: 4,
        lastScoredAt: null,
        updatedAt: new Date('2026-05-08T00:00:00.000Z'),
      },
      {
        position: 2,
        userId: 'user-b',
        username: 'bravo',
        avatar: 'avatar-b',
        country: 'AR',
        favoriteTeamId: 'team-2',
        totalPoints: 8,
        exactPredictions: 1,
        predictionsCount: 4,
        lastScoredAt: null,
        updatedAt: new Date('2026-05-08T00:00:00.000Z'),
      },
    ]);
  });

  it('returns the group ranking for members using the group tournament', async () => {
    const state: PrismaMockState = {
      predictions: [],
      groupMemberships: [{ groupId: 'group-1', userId: 'user-1' }],
      groups: [{ id: 'group-1', tournamentId: 'tournament-group' }],
      scoringRules: [],
      rankingEntries: [
        createRankingEntry({
          tournamentId: 'tournament-group',
          scope: RankingScope.GROUP,
          scopeId: 'group-1',
          userId: 'user-1',
          position: 1,
          totalPoints: 11,
          exactPredictions: 3,
          predictionsCount: 5,
          user: {
            username: 'member',
            avatar: 'avatar-member',
            country: 'UY',
            favoriteTeamId: 'team-9',
          },
        }),
      ],
    };
    const usersService = createUsersServiceMock('user-1');
    const service = createRankingService(createPrismaMock(state), usersService, createTournamentsServiceMock('tournament-active'));

    const ranking = await service.getGroupRanking({
      identity: createIdentity(),
      groupId: 'group-1',
    });

    expect(usersService.syncAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(ranking).toEqual<RankingEntryView[]>([
      {
        position: 1,
        userId: 'user-1',
        username: 'member',
        avatar: 'avatar-member',
        country: 'UY',
        favoriteTeamId: 'team-9',
        totalPoints: 11,
        exactPredictions: 3,
        predictionsCount: 5,
        lastScoredAt: null,
        updatedAt: new Date('2026-05-08T00:00:00.000Z'),
      },
    ]);
  });

  it('rejects unknown groups when requesting a group ranking', async () => {
    const state: PrismaMockState = {
      predictions: [],
      groupMemberships: [],
      groups: [],
      scoringRules: [],
      rankingEntries: [],
    };
    const service = createRankingService(createPrismaMock(state));

    await expect(
      service.getGroupRanking({
        identity: createIdentity(),
        groupId: 'missing-group',
      }),
    ).rejects.toThrow('was not found');
  });

  it('rejects non-members from viewing a group ranking', async () => {
    const state: PrismaMockState = {
      predictions: [],
      groupMemberships: [],
      groups: [{ id: 'group-1', tournamentId: 'tournament-group' }],
      scoringRules: [],
      rankingEntries: [],
    };
    const service = createRankingService(createPrismaMock(state), createUsersServiceMock('user-2'));

    await expect(
      service.getGroupRanking({
        identity: createIdentity(),
        groupId: 'group-1',
      }),
    ).rejects.toThrow('must be a member');
  });
});
