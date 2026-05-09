import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, PredictionScoringStatus, type Match } from '@prisma/client';

import { scorePrediction, type ScorePredictionInput, type ScorePredictionResult } from './scoring.engine';
import { PrismaService } from '../prisma/prisma.service';

export interface ScoreFinalizedMatchSummary {
  matchId: string;
  tournamentId: string;
  scoringRuleId: string;
  pendingCount: number;
  processedCount: number;
  alreadyScoredCount: number;
  scoredAt: Date;
}

interface ScoreableMatch extends Pick<Match, 'id' | 'tournamentId' | 'status' | 'homeScore' | 'awayScore' | 'finalizedAt'> {}

interface ReadyToScoreMatch extends Omit<ScoreableMatch, 'homeScore' | 'awayScore' | 'finalizedAt'> {
  homeScore: number;
  awayScore: number;
  finalizedAt: Date;
}

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  scorePrediction(input: ScorePredictionInput): ScorePredictionResult {
    return scorePrediction(input);
  }

  async scoreFinalizedMatch(matchId: string): Promise<ScoreFinalizedMatchSummary> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        status: true,
        homeScore: true,
        awayScore: true,
        finalizedAt: true,
      },
    });

    if (match === null) {
      throw new NotFoundException(`Match ${matchId} was not found`);
    }

    if (!this.isScoreableMatch(match)) {
      throw new BadRequestException(`Match ${matchId} cannot be scored until it is finished, finalized, and has both scores`);
    }

    const scoringRule = await this.prisma.scoringRule.findFirst({
      where: {
        tournamentId: match.tournamentId,
        isActive: true,
      },
    });

    if (scoringRule === null) {
      throw new NotFoundException(`Active scoring rule not found for tournament ${match.tournamentId}`);
    }

    const pendingPredictions = await this.prisma.prediction.findMany({
      where: {
        matchId,
        scoringStatus: PredictionScoringStatus.PENDING,
      },
      select: {
        id: true,
        homeScore: true,
        awayScore: true,
      },
    });

    const alreadyScoredCount = await this.prisma.prediction.count({
      where: {
        matchId,
        scoringStatus: PredictionScoringStatus.SCORED,
      },
    });

    const scoredAt = new Date();
    let processedCount = 0;

    await this.prisma.$transaction(async (transaction) => {
      for (const prediction of pendingPredictions) {
        const result = scorePrediction({
          prediction: {
            homeScore: prediction.homeScore,
            awayScore: prediction.awayScore,
          },
          actual: {
            homeScore: match.homeScore,
            awayScore: match.awayScore,
          },
          rule: {
            exactScore: scoringRule.exactScore,
            correctSide: scoringRule.correctSide,
            wrongResult: scoringRule.wrongResult,
          },
        });

        const updateResult = await transaction.prediction.updateMany({
          where: {
            id: prediction.id,
            scoringStatus: PredictionScoringStatus.PENDING,
          },
          data: {
            pointsAwarded: result.points,
            scoringStatus: PredictionScoringStatus.SCORED,
            scoredAt,
          },
        });

        processedCount += updateResult.count;
      }
    });

    return {
      matchId,
      tournamentId: match.tournamentId,
      scoringRuleId: scoringRule.id,
      pendingCount: pendingPredictions.length,
      processedCount,
      alreadyScoredCount,
      scoredAt,
    };
  }

  private isScoreableMatch(match: ScoreableMatch): match is ReadyToScoreMatch {
    return (
      match.status === MatchStatus.FINISHED &&
      match.homeScore !== null &&
      match.awayScore !== null &&
      match.finalizedAt !== null
    );
  }
}
