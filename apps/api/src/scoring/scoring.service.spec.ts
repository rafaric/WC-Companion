import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatchStatus, PredictionScoringStatus, type Match, type Prediction, type ScoringRule } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ScoringService, type ScoreFinalizedMatchSummary } from './scoring.service';

interface MatchFindUniqueArgs {
  where: { id: string };
  select: {
    id: boolean;
    tournamentId: boolean;
    status: boolean;
    homeScore: boolean;
    awayScore: boolean;
    finalizedAt: boolean;
  };
}

interface ScoringRuleFindFirstArgs {
  where: {
    tournamentId: string;
    isActive: boolean;
  };
}

interface PredictionFindManyArgs {
  where: {
    matchId: string;
    scoringStatus: PredictionScoringStatus;
  };
  select: {
    id: boolean;
    homeScore: boolean;
    awayScore: boolean;
  };
}

interface PredictionCountArgs {
  where: {
    matchId: string;
    scoringStatus: PredictionScoringStatus;
  };
}

interface PredictionUpdateManyArgs {
  where: {
    id: string;
    scoringStatus: PredictionScoringStatus;
  };
  data: {
    pointsAwarded: number;
    scoringStatus: PredictionScoringStatus;
    scoredAt: Date;
  };
}

interface ScoreableMatchRecord extends Pick<Match, 'id' | 'tournamentId' | 'status' | 'homeScore' | 'awayScore' | 'finalizedAt'> {}

interface ScoreablePredictionRecord extends Pick<Prediction, 'id' | 'matchId' | 'homeScore' | 'awayScore' | 'pointsAwarded' | 'scoringStatus' | 'scoredAt'> {}

interface ScoreableRuleRecord extends Pick<ScoringRule, 'id' | 'tournamentId' | 'exactScore' | 'correctSide' | 'wrongResult' | 'isActive'> {}

interface PrismaMockState {
  matches: ScoreableMatchRecord[];
  predictions: ScoreablePredictionRecord[];
  scoringRules: ScoreableRuleRecord[];
}

interface PrismaMock {
  match: {
    findUnique: jest.Mock<Promise<ScoreableMatchRecord | null>, [MatchFindUniqueArgs]>;
  };
  scoringRule: {
    findFirst: jest.Mock<Promise<ScoreableRuleRecord | null>, [ScoringRuleFindFirstArgs]>;
  };
  prediction: {
    findMany: jest.Mock<Promise<Array<Pick<Prediction, 'id' | 'homeScore' | 'awayScore'>>>, [PredictionFindManyArgs]>;
    count: jest.Mock<Promise<number>, [PredictionCountArgs]>;
    updateMany: jest.Mock<Promise<{ count: number }>, [PredictionUpdateManyArgs]>;
  };
  $transaction: <T>(callback: (transaction: PrismaMock) => Promise<T>) => Promise<T>;
}

function createMatch(overrides: Partial<ScoreableMatchRecord> = {}): ScoreableMatchRecord {
  return {
    id: 'match-1',
    tournamentId: 'tournament-1',
    status: MatchStatus.FINISHED,
    homeScore: 2,
    awayScore: 1,
    finalizedAt: new Date('2026-05-08T12:00:00.000Z'),
    ...overrides,
  };
}

function createPrediction(overrides: Partial<ScoreablePredictionRecord> = {}): ScoreablePredictionRecord {
  return {
    id: 'prediction-1',
    matchId: 'match-1',
    homeScore: 2,
    awayScore: 1,
    pointsAwarded: 0,
    scoringStatus: PredictionScoringStatus.PENDING,
    scoredAt: null,
    ...overrides,
  };
}

function createScoringRule(overrides: Partial<ScoreableRuleRecord> = {}): ScoreableRuleRecord {
  return {
    id: 'rule-1',
    tournamentId: 'tournament-1',
    exactScore: 3,
    correctSide: 1,
    wrongResult: 0,
    isActive: true,
    ...overrides,
  };
}

function createPrismaMock(state: PrismaMockState): PrismaMock {
  let prisma: PrismaMock;
  const $transaction: PrismaMock['$transaction'] = async <T>(callback: (transaction: PrismaMock) => Promise<T>): Promise<T> =>
    callback(prisma);

  prisma = {
    match: {
      findUnique: jest.fn(async ({ where }) => state.matches.find((match) => match.id === where.id) ?? null),
    },
    scoringRule: {
      findFirst: jest.fn(async ({ where }) => {
        const rule = state.scoringRules.find(
          (candidate) => candidate.tournamentId === where.tournamentId && candidate.isActive === where.isActive,
        );

        return rule ?? null;
      }),
    },
    prediction: {
      findMany: jest.fn(async ({ where }) =>
        state.predictions
          .filter((prediction) => prediction.matchId === where.matchId && prediction.scoringStatus === where.scoringStatus)
          .map((prediction) => ({
            id: prediction.id,
            homeScore: prediction.homeScore,
            awayScore: prediction.awayScore,
          })),
      ),
      count: jest.fn(async ({ where }) =>
        state.predictions.filter((prediction) => prediction.matchId === where.matchId && prediction.scoringStatus === where.scoringStatus).length,
      ),
      updateMany: jest.fn(async ({ where, data }) => {
        const prediction = state.predictions.find(
          (candidate) => candidate.id === where.id && candidate.scoringStatus === where.scoringStatus,
        );

        if (prediction === undefined) {
          return { count: 0 };
        }

        prediction.pointsAwarded = data.pointsAwarded;
        prediction.scoringStatus = data.scoringStatus;
        prediction.scoredAt = data.scoredAt;

        return { count: 1 };
      }),
    },
    $transaction,
  };

  return prisma;
}

describe('ScoringService', () => {
  it('scores pending predictions for a finalized match', async () => {
    const state: PrismaMockState = {
      matches: [createMatch()],
      predictions: [
        createPrediction({ id: 'prediction-1', homeScore: 2, awayScore: 1 }),
        createPrediction({ id: 'prediction-2', homeScore: 2, awayScore: 0 }),
        createPrediction({ id: 'prediction-3', homeScore: 0, awayScore: 1, scoringStatus: PredictionScoringStatus.SCORED, pointsAwarded: 99, scoredAt: new Date('2026-05-08T11:00:00.000Z') }),
      ],
      scoringRules: [createScoringRule()],
    };
    const prisma = createPrismaMock(state);
    const service = new ScoringService(prisma as unknown as PrismaService);

    const summary: ScoreFinalizedMatchSummary = await service.scoreFinalizedMatch('match-1');

    expect(summary).toMatchObject({
      matchId: 'match-1',
      tournamentId: 'tournament-1',
      scoringRuleId: 'rule-1',
      pendingCount: 2,
      processedCount: 2,
      alreadyScoredCount: 1,
    });
    expect(summary.scoredAt).toBeInstanceOf(Date);
    expect(state.predictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'prediction-1', pointsAwarded: 3, scoringStatus: PredictionScoringStatus.SCORED, scoredAt: summary.scoredAt }),
        expect.objectContaining({ id: 'prediction-2', pointsAwarded: 1, scoringStatus: PredictionScoringStatus.SCORED, scoredAt: summary.scoredAt }),
        expect.objectContaining({ id: 'prediction-3', pointsAwarded: 99, scoringStatus: PredictionScoringStatus.SCORED }),
      ]),
    );
  });

  it('does not rescore already scored predictions when invoked twice', async () => {
    const state: PrismaMockState = {
      matches: [createMatch()],
      predictions: [
        createPrediction({ id: 'prediction-1', homeScore: 2, awayScore: 1 }),
        createPrediction({ id: 'prediction-2', homeScore: 1, awayScore: 1 }),
      ],
      scoringRules: [createScoringRule()],
    };
    const prisma = createPrismaMock(state);
    const service = new ScoringService(prisma as unknown as PrismaService);

    const firstSummary = await service.scoreFinalizedMatch('match-1');
    const secondSummary = await service.scoreFinalizedMatch('match-1');

    expect(firstSummary.processedCount).toBe(2);
    expect(secondSummary.pendingCount).toBe(0);
    expect(secondSummary.processedCount).toBe(0);
    expect(secondSummary.alreadyScoredCount).toBe(2);
    expect(prisma.prediction.updateMany).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['non-finished match', createMatch({ status: MatchStatus.LIVE })],
    ['missing home score', createMatch({ homeScore: null })],
    ['missing away score', createMatch({ awayScore: null })],
    ['missing finalizedAt', createMatch({ finalizedAt: null })],
  ])('rejects %s', async (_label, match) => {
    const state: PrismaMockState = {
      matches: [match],
      predictions: [],
      scoringRules: [createScoringRule()],
    };
    const prisma = createPrismaMock(state);
    const service = new ScoringService(prisma as unknown as PrismaService);

    await expect(service.scoreFinalizedMatch('match-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the active scoring rule is missing', async () => {
    const state: PrismaMockState = {
      matches: [createMatch()],
      predictions: [],
      scoringRules: [createScoringRule({ isActive: false })],
    };
    const prisma = createPrismaMock(state);
    const service = new ScoringService(prisma as unknown as PrismaService);

    await expect(service.scoreFinalizedMatch('match-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
