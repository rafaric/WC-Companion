import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PredictionScoringStatus, RankingScope, type GroupMembership, type Prediction } from '@prisma/client';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentsService, type TournamentContextInput } from '../tournaments/tournaments.service';
import { UsersService } from '../users/users.service';

const GLOBAL_SCOPE_ID = 'global' as const;

export interface RankingRecalculationSummary {
  scope: RankingScope;
  scopeId: string;
  tournamentId: string;
  processedCount: number;
}

interface ScoredPredictionRecord extends Pick<Prediction, 'userId' | 'pointsAwarded'> {
  scoredAt: Date;
}

interface GroupMemberRecord extends Pick<GroupMembership, 'userId'> {}

interface RankingAggregate {
  userId: string;
  totalPoints: number;
  exactPredictions: number;
  predictionsCount: number;
  lastScoredAt: Date;
}

interface RankedAggregate extends RankingAggregate {
  position: number;
}

const RANKING_ENTRY_VIEW_SELECT = {
  position: true,
  userId: true,
  totalPoints: true,
  exactPredictions: true,
  predictionsCount: true,
  lastScoredAt: true,
  updatedAt: true,
  user: {
    select: {
      username: true,
      avatar: true,
      country: true,
      favoriteTeamId: true,
    },
  },
} as const;

interface RankingUserRecord {
  username: string;
  avatar: string | null;
  country: string | null;
  favoriteTeamId: string | null;
}

interface RankingEntryRecord {
  position: number;
  userId: string;
  totalPoints: number;
  exactPredictions: number;
  predictionsCount: number;
  lastScoredAt: Date | null;
  updatedAt: Date;
  user: RankingUserRecord;
}

export interface RankingEntryView {
  position: number;
  userId: string;
  username: string;
  avatar: string | null;
  country: string | null;
  favoriteTeamId: string | null;
  totalPoints: number;
  exactPredictions: number;
  predictionsCount: number;
  lastScoredAt: Date | null;
  updatedAt: Date;
}

interface GroupRecord {
  tournamentId: string;
}

@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  async getActiveGlobalRanking(input?: { tournamentContext?: TournamentContextInput }): Promise<RankingEntryView[]> {
    const resolved = await this.tournamentsService.resolveTournamentContext(input?.tournamentContext ?? {});

    return this.loadRankingEntries({
      tournamentId: resolved.tournament.id,
      scope: RankingScope.GLOBAL,
      scopeId: GLOBAL_SCOPE_ID,
    });
  }

  async getGlobalRanking(input?: { tournamentId?: string; tournamentContext?: TournamentContextInput }): Promise<RankingEntryView[]> {
    let tournamentId: string;

    if (input?.tournamentId !== undefined) {
      tournamentId = input.tournamentId;
    } else {
      const resolved = await this.tournamentsService.resolveTournamentContext(input?.tournamentContext ?? {});
      tournamentId = resolved.tournament.id;
    }

    return this.loadRankingEntries({
      tournamentId,
      scope: RankingScope.GLOBAL,
      scopeId: GLOBAL_SCOPE_ID,
    });
  }

  async getGroupRanking(input: { identity: AuthenticatedIdentity; groupId: string }): Promise<RankingEntryView[]> {
    const user = await this.usersService.syncAuthenticatedUser(input.identity);
    const group = await this.prisma.group.findFirst({
      where: {
        id: input.groupId,
      },
      select: {
        tournamentId: true,
      },
    });

    if (group === null) {
      throw new NotFoundException(`Group ${input.groupId} was not found`);
    }

    const membership = await this.prisma.groupMembership.findFirst({
      where: {
        groupId: input.groupId,
        userId: user.id,
      },
      select: {
        userId: true,
      },
    });

    if (membership === null) {
      throw new ForbiddenException('You must be a member of this group to view its ranking');
    }

    return this.loadRankingEntries({
      tournamentId: group.tournamentId,
      scope: RankingScope.GROUP,
      scopeId: input.groupId,
    });
  }

  async recalculateGlobalRanking(tournamentId: string): Promise<RankingRecalculationSummary> {
    return this.recalculateRanking({
      tournamentId,
      scope: RankingScope.GLOBAL,
      scopeId: GLOBAL_SCOPE_ID,
    });
  }

  async recalculateGroupRanking(tournamentId: string, groupId: string): Promise<RankingRecalculationSummary> {
    const groupMembers = await this.prisma.groupMembership.findMany({
      where: {
        groupId,
      },
      select: {
        userId: true,
      },
    });

    const memberUserIds = this.uniqueUserIds(groupMembers);

    return this.recalculateRanking({
      tournamentId,
      scope: RankingScope.GROUP,
      scopeId: groupId,
      userIds: memberUserIds,
    });
  }

  private async recalculateRanking(input: {
    tournamentId: string;
    scope: RankingScope;
    scopeId: string;
    userIds?: string[];
  }): Promise<RankingRecalculationSummary> {
    const scoredPredictions = await this.loadScoredPredictions(input.tournamentId, input.userIds);

    if (scoredPredictions.length === 0) {
      await this.prisma.rankingEntry.deleteMany({
        where: {
          tournamentId: input.tournamentId,
          scope: input.scope,
          scopeId: input.scopeId,
        },
      });

      return {
        scope: input.scope,
        scopeId: input.scopeId,
        tournamentId: input.tournamentId,
        processedCount: 0,
      };
    }

    const scoringRule = await this.prisma.scoringRule.findFirst({
      where: {
        tournamentId: input.tournamentId,
        isActive: true,
      },
      select: {
        exactScore: true,
      },
    });

    if (scoringRule === null) {
      throw new NotFoundException(`Active scoring rule not found for tournament ${input.tournamentId}`);
    }

    const rankedEntries = this.buildRankedEntries(scoredPredictions, scoringRule.exactScore);
    const rankedUserIds = rankedEntries.map((entry) => entry.userId);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.rankingEntry.deleteMany({
        where: {
          tournamentId: input.tournamentId,
          scope: input.scope,
          scopeId: input.scopeId,
          userId: {
            notIn: rankedUserIds,
          },
        },
      });

      for (const entry of rankedEntries) {
        await transaction.rankingEntry.upsert({
          where: {
            tournamentId_scope_scopeId_userId: {
              tournamentId: input.tournamentId,
              scope: input.scope,
              scopeId: input.scopeId,
              userId: entry.userId,
            },
          },
          create: {
            tournamentId: input.tournamentId,
            scope: input.scope,
            scopeId: input.scopeId,
            userId: entry.userId,
            position: entry.position,
            totalPoints: entry.totalPoints,
            exactPredictions: entry.exactPredictions,
            predictionsCount: entry.predictionsCount,
            lastScoredAt: entry.lastScoredAt,
          },
          update: {
            position: entry.position,
            totalPoints: entry.totalPoints,
            exactPredictions: entry.exactPredictions,
            predictionsCount: entry.predictionsCount,
            lastScoredAt: entry.lastScoredAt,
          },
        });
      }
    });

    return {
      scope: input.scope,
      scopeId: input.scopeId,
      tournamentId: input.tournamentId,
      processedCount: rankedEntries.length,
    };
  }

  private async loadScoredPredictions(tournamentId: string, userIds?: string[]): Promise<ScoredPredictionRecord[]> {
    if (userIds !== undefined && userIds.length === 0) {
      return [];
    }

    const scoredPredictions = await this.prisma.prediction.findMany({
      where: {
        tournamentId,
        scoringStatus: PredictionScoringStatus.SCORED,
        ...(userIds === undefined ? {} : { userId: { in: userIds } }),
      },
      select: {
        userId: true,
        pointsAwarded: true,
        scoredAt: true,
      },
    });

    return scoredPredictions.map((prediction) => {
      if (prediction.scoredAt === null) {
        throw new Error(`Scored prediction for user ${prediction.userId} is missing scoredAt`);
      }

      return {
        userId: prediction.userId,
        pointsAwarded: prediction.pointsAwarded,
        scoredAt: prediction.scoredAt,
      };
    });
  }

  private buildRankedEntries(predictions: ScoredPredictionRecord[], exactScore: number): RankedAggregate[] {
    const aggregates = new Map<string, RankingAggregate>();

    for (const prediction of predictions) {
      const aggregate = aggregates.get(prediction.userId);

      if (aggregate === undefined) {
        aggregates.set(prediction.userId, {
          userId: prediction.userId,
          totalPoints: prediction.pointsAwarded,
          // MVP limitation: the schema only stores pointsAwarded, so exact hits are inferred by
          // comparing against the active rule's exactScore. If scoring bands ever overlap, store
          // the scoring kind separately and revisit this counter.
          exactPredictions: prediction.pointsAwarded === exactScore ? 1 : 0,
          predictionsCount: 1,
          lastScoredAt: prediction.scoredAt,
        });
        continue;
      }

      aggregate.totalPoints += prediction.pointsAwarded;
      aggregate.exactPredictions += prediction.pointsAwarded === exactScore ? 1 : 0;
      aggregate.predictionsCount += 1;

      if (prediction.scoredAt > aggregate.lastScoredAt) {
        aggregate.lastScoredAt = prediction.scoredAt;
      }
    }

    const sortedAggregates = Array.from(aggregates.values()).sort((left, right) => {
      if (left.totalPoints !== right.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (left.exactPredictions !== right.exactPredictions) {
        return right.exactPredictions - left.exactPredictions;
      }

      if (left.predictionsCount !== right.predictionsCount) {
        return right.predictionsCount - left.predictionsCount;
      }

      if (left.lastScoredAt.getTime() !== right.lastScoredAt.getTime()) {
        return left.lastScoredAt.getTime() - right.lastScoredAt.getTime();
      }

      if (left.userId < right.userId) {
        return -1;
      }

      if (left.userId > right.userId) {
        return 1;
      }

      return 0;
    });

    let position = 0;
    let previousRankKey: string | null = null;

    return sortedAggregates.map((aggregate) => {
      const rankKey = [aggregate.totalPoints, aggregate.exactPredictions, aggregate.predictionsCount].join(':');

      if (rankKey !== previousRankKey) {
        position += 1;
        previousRankKey = rankKey;
      }

      return {
        ...aggregate,
        position,
      };
    });
  }

  private uniqueUserIds(records: GroupMemberRecord[]): string[] {
    return Array.from(new Set(records.map((record) => record.userId)));
  }

  private async loadRankingEntries(input: {
    tournamentId: string;
    scope: RankingScope;
    scopeId: string;
  }): Promise<RankingEntryView[]> {
    const rankingEntries = await this.prisma.rankingEntry.findMany({
      where: {
        tournamentId: input.tournamentId,
        scope: input.scope,
        scopeId: input.scopeId,
      },
      orderBy: [
        {
          position: 'asc',
        },
        {
          totalPoints: 'desc',
        },
        {
          userId: 'asc',
        },
      ],
      select: RANKING_ENTRY_VIEW_SELECT,
    });

    return rankingEntries.map((entry) => this.toRankingEntryView(entry as RankingEntryRecord));
  }

  private toRankingEntryView(entry: RankingEntryRecord): RankingEntryView {
    return {
      position: entry.position,
      userId: entry.userId,
      username: entry.user.username,
      avatar: entry.user.avatar,
      country: entry.user.country,
      favoriteTeamId: entry.user.favoriteTeamId,
      totalPoints: entry.totalPoints,
      exactPredictions: entry.exactPredictions,
      predictionsCount: entry.predictionsCount,
      lastScoredAt: entry.lastScoredAt,
      updatedAt: entry.updatedAt,
    };
  }
}
