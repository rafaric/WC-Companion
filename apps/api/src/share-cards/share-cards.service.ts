import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RankingScope, ShareCardType, type Prisma } from '@prisma/client';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { UsersService } from '../users/users.service';

const GLOBAL_SCOPE_ID = 'global' as const;

const SHARE_CARD_TYPES = {
  PERFORMANCE_SUMMARY: ShareCardType.PERFORMANCE_SUMMARY,
  GROUP_RANKING: ShareCardType.GROUP_RANKING,
} as const;

const SHARE_CARD_VIEW_SELECT = {
  id: true,
  type: true,
  imageUrl: true,
  createdAt: true,
} as const;

const RANKING_ENTRY_SELECT = {
  position: true,
  totalPoints: true,
  exactPredictions: true,
  predictionsCount: true,
  user: {
    select: {
      username: true,
      country: true,
      avatar: true,
    },
  },
} as const;

const GROUP_MEMBERSHIP_SELECT = {
  group: {
    select: {
      id: true,
      name: true,
      tournament: {
        select: {
          id: true,
          name: true,
          year: true,
        },
      },
    },
  },
} as const;

export interface ShareCardView {
  id: string;
  type: ShareCardType;
  imageUrl: string | null;
  payload: ShareCardPayloadSnapshot;
  createdAt: Date;
}

interface ShareCardRow {
  id: string;
  type: ShareCardType;
  imageUrl: string | null;
  createdAt: Date;
}

interface TournamentSnapshot {
  id: string;
  name: string;
  year: number;
}

interface RankingUserSnapshot {
  username: string;
  country: string | null;
  avatar: string | null;
}

interface RankingEntrySnapshot {
  position: number;
  totalPoints: number;
  exactPredictions: number;
  predictionsCount: number;
  user: RankingUserSnapshot;
}

interface GroupMembershipSnapshot {
  group: {
    id: string;
    name: string;
    tournament: TournamentSnapshot;
  };
}

interface ShareCardPayloadBase {
  cardType: string;
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
  cardType: typeof SHARE_CARD_TYPES.PERFORMANCE_SUMMARY;
}

export interface GroupRankingShareCardPayload extends ShareCardPayloadBase {
  cardType: typeof SHARE_CARD_TYPES.GROUP_RANKING;
  groupName: string;
}

export type ShareCardPayloadSnapshot = PerformanceSummaryShareCardPayload | GroupRankingShareCardPayload;

@Injectable()
export class ShareCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  async createMyGlobalRankingShareCard(identity: AuthenticatedIdentity): Promise<ShareCardView> {
    const user = await this.usersService.syncAuthenticatedUser(identity);
    const tournament = await this.tournamentsService.getActiveTournament();
    const rankingEntry = await this.prisma.rankingEntry.findFirst({
      where: {
        tournamentId: tournament.id,
        scope: RankingScope.GLOBAL,
        scopeId: GLOBAL_SCOPE_ID,
        userId: user.id,
      },
      select: RANKING_ENTRY_SELECT,
    });

    if (rankingEntry === null) {
      throw new NotFoundException('Global ranking is not available yet');
    }

    return this.createShareCard({
      type: SHARE_CARD_TYPES.PERFORMANCE_SUMMARY,
      tournament,
      userId: user.id,
      payload: this.buildPerformanceSummaryPayload(tournament, rankingEntry),
    });
  }

  async createGroupRankingShareCard(identity: AuthenticatedIdentity, groupId: string): Promise<ShareCardView> {
    const user = await this.usersService.syncAuthenticatedUser(identity);
    const membership = await this.prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId: user.id,
      },
      select: GROUP_MEMBERSHIP_SELECT,
    });

    if (membership === null) {
      throw new ForbiddenException('You must be a member of this group to create its share card');
    }

    const rankingEntry = await this.prisma.rankingEntry.findFirst({
      where: {
        tournamentId: membership.group.tournament.id,
        scope: RankingScope.GROUP,
        scopeId: groupId,
        userId: user.id,
      },
      select: RANKING_ENTRY_SELECT,
    });

    if (rankingEntry === null) {
      throw new NotFoundException('Group ranking is not available yet');
    }

    return this.createShareCard({
      type: SHARE_CARD_TYPES.GROUP_RANKING,
      tournament: membership.group.tournament,
      userId: user.id,
      groupId,
      payload: this.buildGroupRankingPayload(membership.group.name, membership.group.tournament, rankingEntry),
    });
  }

  private async createShareCard(input: {
    type: ShareCardType;
    tournament: TournamentSnapshot;
    userId: string;
    groupId?: string;
    payload: ShareCardPayloadSnapshot;
  }): Promise<ShareCardView> {
    const createdShareCard = await this.prisma.shareCard.create({
      data: {
        type: input.type,
        tournamentId: input.tournament.id,
        userId: input.userId,
        ...(input.groupId === undefined ? {} : { groupId: input.groupId }),
        payload: input.payload as unknown as Prisma.InputJsonValue,
      },
      select: SHARE_CARD_VIEW_SELECT,
    });

    return {
      ...createdShareCard,
      payload: input.payload,
    };
  }

  private buildPerformanceSummaryPayload(
    tournament: TournamentSnapshot,
    rankingEntry: RankingEntrySnapshot,
  ): PerformanceSummaryShareCardPayload {
    return {
      cardType: SHARE_CARD_TYPES.PERFORMANCE_SUMMARY,
      tournamentName: tournament.name,
      tournamentYear: tournament.year,
      username: rankingEntry.user.username,
      country: rankingEntry.user.country,
      avatar: rankingEntry.user.avatar,
      position: rankingEntry.position,
      totalPoints: rankingEntry.totalPoints,
      exactPredictions: rankingEntry.exactPredictions,
      predictionsCount: rankingEntry.predictionsCount,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildGroupRankingPayload(
    groupName: string,
    tournament: TournamentSnapshot,
    rankingEntry: RankingEntrySnapshot,
  ): GroupRankingShareCardPayload {
    return {
      cardType: SHARE_CARD_TYPES.GROUP_RANKING,
      groupName,
      tournamentName: tournament.name,
      tournamentYear: tournament.year,
      username: rankingEntry.user.username,
      country: rankingEntry.user.country,
      avatar: rankingEntry.user.avatar,
      position: rankingEntry.position,
      totalPoints: rankingEntry.totalPoints,
      exactPredictions: rankingEntry.exactPredictions,
      predictionsCount: rankingEntry.predictionsCount,
      generatedAt: new Date().toISOString(),
    };
  }
}
