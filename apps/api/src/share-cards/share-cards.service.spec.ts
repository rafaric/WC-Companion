import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RankingScope, ShareCardType } from '@prisma/client';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { TournamentsService } from '../tournaments/tournaments.service';
import type { UsersService } from '../users/users.service';
import {
  ShareCardsService,
  type GroupRankingShareCardPayload,
  type PerformanceSummaryShareCardPayload,
} from './share-cards.service';

interface TournamentRecord {
  id: string;
  name: string;
  year: number;
}

interface RankingUserRecord {
  username: string;
  country: string | null;
  avatar: string | null;
}

interface RankingEntryRecord {
  position: number;
  totalPoints: number;
  exactPredictions: number;
  predictionsCount: number;
  user: RankingUserRecord;
}

interface GroupMembershipRecord {
  group: {
    id: string;
    name: string;
    tournament: TournamentRecord;
  };
}

interface ShareCardRecord {
  id: string;
  type: ShareCardType;
  imageUrl: string | null;
  createdAt: Date;
}

interface RankingEntryFindFirstArgs {
  where: {
    tournamentId: string;
    scope: RankingScope;
    scopeId: string;
    userId: string;
  };
  select: Record<string, boolean>;
}

interface GroupMembershipFindFirstArgs {
  where: {
    groupId: string;
    userId: string;
  };
  select: Record<string, unknown>;
}

interface ShareCardCreateArgs {
  data: {
    type: ShareCardType;
    tournamentId: string;
    userId: string;
    groupId?: string;
    payload: PerformanceSummaryShareCardPayload | GroupRankingShareCardPayload;
  };
  select: Record<string, boolean>;
}

interface PrismaMock {
  rankingEntry: {
    findFirst: jest.Mock<Promise<RankingEntryRecord | null>, [RankingEntryFindFirstArgs]>;
  };
  groupMembership: {
    findFirst: jest.Mock<Promise<GroupMembershipRecord | null>, [GroupMembershipFindFirstArgs]>;
  };
  shareCard: {
    create: jest.Mock<Promise<ShareCardRecord>, [ShareCardCreateArgs]>;
  };
}

interface UsersServiceMock {
  syncAuthenticatedUser: jest.Mock<Promise<{ id: string }>, [AuthenticatedIdentity]>;
}

interface TournamentsServiceMock {
  getActiveTournament: jest.Mock<Promise<TournamentRecord>, []>;
}

function createIdentity(overrides: Partial<AuthenticatedIdentity> = {}): AuthenticatedIdentity {
  return {
    authSubject: 'auth0|123456789',
    email: 'messi@example.com',
    name: 'Lionel Messi',
    nickname: 'messi',
    picture: 'https://example.com/avatar.png',
    permissions: [],
    ...overrides,
  };
}

function createTournament(overrides: Partial<TournamentRecord> = {}): TournamentRecord {
  return {
    id: 'tournament-1',
    name: 'World Predict Cup',
    year: 2026,
    ...overrides,
  };
}

function createRankingEntry(overrides: Partial<RankingEntryRecord> = {}): RankingEntryRecord {
  return {
    position: 1,
    totalPoints: 42,
    exactPredictions: 7,
    predictionsCount: 10,
    user: {
      username: 'messi',
      country: 'AR',
      avatar: 'https://example.com/avatar.png',
    },
    ...overrides,
  };
}

function createGroupMembership(overrides: Partial<GroupMembershipRecord> = {}): GroupMembershipRecord {
  return {
    group: {
      id: 'group-1',
      name: 'Friends of Messi',
      tournament: createTournament(),
    },
    ...overrides,
  };
}

function createPrismaMock(state: {
  rankingEntry: RankingEntryRecord | null;
  groupMembership: GroupMembershipRecord | null;
  createdAt?: Date;
}): PrismaMock {
  return {
    rankingEntry: {
      findFirst: jest.fn(async (_args: RankingEntryFindFirstArgs) => state.rankingEntry),
    },
    groupMembership: {
      findFirst: jest.fn(async (_args: GroupMembershipFindFirstArgs) => state.groupMembership),
    },
    shareCard: {
      create: jest.fn(async (args: ShareCardCreateArgs) => ({
        id: 'share-card-1',
        type: args.data.type,
        imageUrl: null,
        createdAt: state.createdAt ?? new Date('2026-05-08T12:00:00.000Z'),
      })),
    },
  };
}

function createUsersServiceMock(userId = 'user-1'): UsersServiceMock {
  return {
    syncAuthenticatedUser: jest.fn(async (_identity: AuthenticatedIdentity) => ({ id: userId })),
  };
}

function createTournamentsServiceMock(activeTournament: TournamentRecord = createTournament()): TournamentsServiceMock {
  return {
    getActiveTournament: jest.fn(async () => activeTournament),
  };
}

function createService(prisma: PrismaMock, usersService: UsersServiceMock, tournamentsService: TournamentsServiceMock): ShareCardsService {
  return new ShareCardsService(prisma as unknown as PrismaService, usersService as unknown as UsersService, tournamentsService as unknown as TournamentsService);
}

describe('ShareCardsService', () => {
  it('creates a global ranking share card payload', async () => {
    const tournament = createTournament();
    const rankingEntry = createRankingEntry();
    const prisma = createPrismaMock({ rankingEntry, groupMembership: null });
    const usersService = createUsersServiceMock();
    const tournamentsService = createTournamentsServiceMock(tournament);
    const service = createService(prisma, usersService, tournamentsService);

    const result = await service.createMyGlobalRankingShareCard(createIdentity());

    expect(usersService.syncAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(tournamentsService.getActiveTournament).toHaveBeenCalledTimes(1);
    expect(prisma.rankingEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tournamentId: tournament.id,
          scope: RankingScope.GLOBAL,
          scopeId: 'global',
          userId: 'user-1',
        },
      }),
    );
    expect(prisma.shareCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: ShareCardType.PERFORMANCE_SUMMARY,
          tournamentId: tournament.id,
          userId: 'user-1',
          payload: expect.objectContaining({
            cardType: ShareCardType.PERFORMANCE_SUMMARY,
            tournamentName: tournament.name,
            tournamentYear: tournament.year,
            username: rankingEntry.user.username,
            country: rankingEntry.user.country,
            avatar: rankingEntry.user.avatar,
            position: rankingEntry.position,
            totalPoints: rankingEntry.totalPoints,
            exactPredictions: rankingEntry.exactPredictions,
            predictionsCount: rankingEntry.predictionsCount,
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      id: 'share-card-1',
      type: ShareCardType.PERFORMANCE_SUMMARY,
      imageUrl: null,
      payload: {
        cardType: ShareCardType.PERFORMANCE_SUMMARY,
        tournamentName: tournament.name,
        tournamentYear: tournament.year,
        username: rankingEntry.user.username,
        country: rankingEntry.user.country,
        avatar: rankingEntry.user.avatar,
        position: rankingEntry.position,
        totalPoints: rankingEntry.totalPoints,
        exactPredictions: rankingEntry.exactPredictions,
        predictionsCount: rankingEntry.predictionsCount,
        generatedAt: expect.any(String),
      },
      createdAt: new Date('2026-05-08T12:00:00.000Z'),
    });
  });

  it('rejects when the user has no ranking entry', async () => {
    const prisma = createPrismaMock({ rankingEntry: null, groupMembership: null });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());
    const request = service.createMyGlobalRankingShareCard(createIdentity());

    await expect(request).rejects.toBeInstanceOf(NotFoundException);
    await expect(request).rejects.toThrow('Global ranking is not available yet');
  });

  it('creates a group ranking share card payload for a member', async () => {
    const membership = createGroupMembership();
    const rankingEntry = createRankingEntry();
    const prisma = createPrismaMock({ rankingEntry, groupMembership: membership });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());

    const result = await service.createGroupRankingShareCard(createIdentity(), membership.group.id);

    expect(prisma.groupMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          groupId: membership.group.id,
          userId: 'user-1',
        },
      }),
    );
    expect(prisma.rankingEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tournamentId: membership.group.tournament.id,
          scope: RankingScope.GROUP,
          scopeId: membership.group.id,
          userId: 'user-1',
        },
      }),
    );
    expect(prisma.shareCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: ShareCardType.GROUP_RANKING,
          groupId: membership.group.id,
          payload: expect.objectContaining({
            cardType: ShareCardType.GROUP_RANKING,
            groupName: membership.group.name,
            tournamentName: membership.group.tournament.name,
            tournamentYear: membership.group.tournament.year,
            username: rankingEntry.user.username,
            country: rankingEntry.user.country,
            avatar: rankingEntry.user.avatar,
            position: rankingEntry.position,
            totalPoints: rankingEntry.totalPoints,
            exactPredictions: rankingEntry.exactPredictions,
            predictionsCount: rankingEntry.predictionsCount,
          }),
        }),
      }),
    );
    expect(result).toMatchObject({
      payload: {
        cardType: ShareCardType.GROUP_RANKING,
        groupName: membership.group.name,
        tournamentName: membership.group.tournament.name,
        tournamentYear: membership.group.tournament.year,
        username: rankingEntry.user.username,
        country: rankingEntry.user.country,
        avatar: rankingEntry.user.avatar,
        position: rankingEntry.position,
        totalPoints: rankingEntry.totalPoints,
        exactPredictions: rankingEntry.exactPredictions,
        predictionsCount: rankingEntry.predictionsCount,
        generatedAt: expect.any(String),
      },
    });
  });

  it('rejects group share cards for non-members', async () => {
    const prisma = createPrismaMock({ rankingEntry: createRankingEntry(), groupMembership: null });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());
    const request = service.createGroupRankingShareCard(createIdentity(), 'group-1');

    await expect(request).rejects.toBeInstanceOf(ForbiddenException);
    await expect(request).rejects.toThrow(
      'You must be a member of this group to create its share card',
    );
  });
});
