import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RankingsService, type RankingRecalculationSummary } from '../rankings/rankings.service';
import { ScoringService, type ScoreFinalizedMatchSummary } from '../scoring/scoring.service';
import { MatchesService, type FinalizeMatchSummary } from './matches.service';

interface MatchFindUniqueArgs {
  where: { id: string };
  select: {
    id: boolean;
    tournamentId: boolean;
  };
}

interface MatchUpdateArgs {
  where: { id: string };
  data: {
    status: 'FINISHED';
    homeScore: number;
    awayScore: number;
    finalizedAt: Date;
  };
  select: {
    id: boolean;
    tournamentId: boolean;
  };
}

interface GroupFindManyArgs {
  where: {
    tournamentId: string;
  };
  select: {
    id: boolean;
  };
}

interface MatchRecord {
  id: string;
  tournamentId: string;
}

interface GroupRecord {
  id: string;
  tournamentId: string;
}

interface PrismaMock {
  match: {
    findUnique: jest.Mock<Promise<MatchRecord | null>, [MatchFindUniqueArgs]>;
    update: jest.Mock<Promise<MatchRecord>, [MatchUpdateArgs]>;
  };
  group: {
    findMany: jest.Mock<Promise<Array<Pick<GroupRecord, 'id'>>>, [GroupFindManyArgs]>;
  };
}

interface PrismaMockState {
  matches: MatchRecord[];
  groups: GroupRecord[];
}

function createPrismaMock(state: PrismaMockState): PrismaMock {
  return {
    match: {
      findUnique: jest.fn(async ({ where }) => state.matches.find((match) => match.id === where.id) ?? null),
      update: jest.fn(async ({ where }) => {
        const match = state.matches.find((candidate) => candidate.id === where.id);

        if (match === undefined) {
          throw new Error(`Expected match ${where.id} to exist`);
        }

        return match;
      }),
    },
    group: {
      findMany: jest.fn(async ({ where }) => state.groups.filter((group) => group.tournamentId === where.tournamentId).map(({ id }) => ({ id }))),
    },
  };
}

function createScoringServiceMock(summary: ScoreFinalizedMatchSummary): ScoringService {
  return {
    scoreFinalizedMatch: jest.fn(async () => summary),
  } as unknown as ScoringService;
}

function createRankingsServiceMock(
  globalSummary: RankingRecalculationSummary,
  groupSummaries: RankingRecalculationSummary[],
): RankingsService {
  const service = {
    recalculateGlobalRanking: jest.fn(async () => globalSummary),
    recalculateGroupRanking: jest.fn(async (_tournamentId: string, _groupId: string) => {
      const summary = groupSummaries.shift();

      if (summary === undefined) {
        throw new Error('Unexpected group recalculation');
      }

      return summary;
    }),
  };

  return service as unknown as RankingsService;
}

describe('MatchesService', () => {
  it('finalizes a match and recalculates scoring and rankings', async () => {
    const state: PrismaMockState = {
      matches: [{ id: 'match-1', tournamentId: 'tournament-1' }],
      groups: [
        { id: 'group-1', tournamentId: 'tournament-1' },
        { id: 'group-2', tournamentId: 'tournament-1' },
      ],
    };
    const prisma = createPrismaMock(state);
    const scoringService = createScoringServiceMock({
      matchId: 'match-1',
      tournamentId: 'tournament-1',
      scoringRuleId: 'rule-1',
      pendingCount: 2,
      processedCount: 2,
      alreadyScoredCount: 0,
      scoredAt: new Date('2026-05-08T12:00:00.000Z'),
    });
    const rankingsService = createRankingsServiceMock(
      {
        scope: 'GLOBAL',
        scopeId: 'global',
        tournamentId: 'tournament-1',
        processedCount: 4,
      },
      [
        { scope: 'GROUP', scopeId: 'group-1', tournamentId: 'tournament-1', processedCount: 2 },
        { scope: 'GROUP', scopeId: 'group-2', tournamentId: 'tournament-1', processedCount: 1 },
      ],
    );
    const service = new MatchesService(
      prisma as unknown as PrismaService,
      scoringService,
      rankingsService,
    );

    const summary: FinalizeMatchSummary = await service.finalizeMatch({
      matchId: 'match-1',
      homeScore: 2,
      awayScore: 1,
    });

    expect(summary).toMatchObject({
      matchId: 'match-1',
      tournamentId: 'tournament-1',
      scoringSummary: {
        matchId: 'match-1',
        tournamentId: 'tournament-1',
      },
      globalRankingSummary: {
        scope: 'GLOBAL',
        scopeId: 'global',
        tournamentId: 'tournament-1',
      },
      groupRankingSummaries: [
        { scope: 'GROUP', scopeId: 'group-1', tournamentId: 'tournament-1' },
        { scope: 'GROUP', scopeId: 'group-2', tournamentId: 'tournament-1' },
      ],
    });
    expect(prisma.match.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'match-1' },
        data: expect.objectContaining({
          status: 'FINISHED',
          homeScore: 2,
          awayScore: 1,
          finalizedAt: expect.any(Date),
        }),
      }),
    );
    expect(scoringService.scoreFinalizedMatch).toHaveBeenCalledWith('match-1');
    expect(rankingsService.recalculateGlobalRanking).toHaveBeenCalledWith('tournament-1');
    expect(rankingsService.recalculateGroupRanking).toHaveBeenNthCalledWith(1, 'tournament-1', 'group-1');
    expect(rankingsService.recalculateGroupRanking).toHaveBeenNthCalledWith(2, 'tournament-1', 'group-2');
  });

  it.each([
    ['negative home score', -1, 0],
    ['negative away score', 0, -1],
    ['fractional home score', 1.5, 0],
    ['fractional away score', 0, 2.25],
    ['missing home score', undefined, 0],
    ['missing away score', 0, undefined],
    ['string home score', '2', 0],
    ['string away score', 0, '1'],
  ])('rejects %s', async (_label, homeScore, awayScore) => {
    const prisma = createPrismaMock({ matches: [], groups: [] });
    const service = new MatchesService(
      prisma as unknown as PrismaService,
      createScoringServiceMock({
        matchId: 'match-1',
        tournamentId: 'tournament-1',
        scoringRuleId: 'rule-1',
        pendingCount: 0,
        processedCount: 0,
        alreadyScoredCount: 0,
        scoredAt: new Date('2026-05-08T12:00:00.000Z'),
      }),
      createRankingsServiceMock(
        { scope: 'GLOBAL', scopeId: 'global', tournamentId: 'tournament-1', processedCount: 0 },
        [],
      ),
    );

    await expect(
      service.finalizeMatch({
        matchId: 'match-1',
        homeScore,
        awayScore,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('handles match not found', async () => {
    const prisma = createPrismaMock({ matches: [], groups: [] });
    const service = new MatchesService(
      prisma as unknown as PrismaService,
      createScoringServiceMock({
        matchId: 'match-1',
        tournamentId: 'tournament-1',
        scoringRuleId: 'rule-1',
        pendingCount: 0,
        processedCount: 0,
        alreadyScoredCount: 0,
        scoredAt: new Date('2026-05-08T12:00:00.000Z'),
      }),
      createRankingsServiceMock(
        { scope: 'GLOBAL', scopeId: 'global', tournamentId: 'tournament-1', processedCount: 0 },
        [],
      ),
    );

    await expect(
      service.finalizeMatch({
        matchId: 'match-1',
        homeScore: 2,
        awayScore: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
