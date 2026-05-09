import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, PredictionScoringStatus, type Prediction } from '@prisma/client';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const PREDICTION_VIEW_SELECT = {
  id: true,
  matchId: true,
  tournamentId: true,
  homeScore: true,
  awayScore: true,
  pointsAwarded: true,
  scoringStatus: true,
  submittedAt: true,
  updatedAt: true,
  scoredAt: true,
} as const;

export interface SubmitPredictionInput {
  identity: AuthenticatedIdentity;
  matchId: string;
  homeScore: number;
  awayScore: number;
}

export interface GetMyPredictionsInput {
  identity: AuthenticatedIdentity;
}

export interface PredictionView {
  id: string;
  matchId: string;
  tournamentId: string;
  homeScore: number;
  awayScore: number;
  pointsAwarded: number;
  scoringStatus: PredictionScoringStatus;
  submittedAt: Date;
  updatedAt: Date;
  scoredAt: Date | null;
}

interface MatchRecord {
  id: string;
  tournamentId: string;
  kickoffAt: Date;
  status: MatchStatus;
}

interface PredictionRecord extends Pick<Prediction, 'id' | 'matchId' | 'tournamentId' | 'homeScore' | 'awayScore' | 'pointsAwarded' | 'scoringStatus' | 'submittedAt' | 'updatedAt' | 'scoredAt'> {}

@Injectable()
export class PredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async submitPrediction(input: SubmitPredictionInput): Promise<PredictionView> {
    this.assertValidScores(input.homeScore, input.awayScore);

    const match = await this.prisma.match.findUnique({
      where: { id: input.matchId },
      select: {
        id: true,
        tournamentId: true,
        kickoffAt: true,
        status: true,
      },
    });

    if (match === null) {
      throw new NotFoundException(`Match ${input.matchId} was not found`);
    }

    if (match.status !== MatchStatus.UPCOMING) {
      throw new BadRequestException(`Match ${input.matchId} is no longer open for predictions`);
    }

    if (Date.now() >= match.kickoffAt.getTime()) {
      throw new BadRequestException(`Match ${input.matchId} is no longer open for predictions`);
    }

    const user = await this.usersService.syncAuthenticatedUser(input.identity);

    const prediction = await this.prisma.prediction.upsert({
      where: {
        userId_matchId: {
          userId: user.id,
          matchId: match.id,
        },
      },
      create: {
        tournamentId: match.tournamentId,
        matchId: match.id,
        userId: user.id,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        pointsAwarded: 0,
        scoringStatus: PredictionScoringStatus.PENDING,
      },
      update: {
        tournamentId: match.tournamentId,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        pointsAwarded: 0,
        scoringStatus: PredictionScoringStatus.PENDING,
      },
      select: PREDICTION_VIEW_SELECT,
    });

    return this.toPredictionView(prediction);
  }

  async getMyPredictions(input: GetMyPredictionsInput): Promise<PredictionView[]> {
    const user = await this.usersService.syncAuthenticatedUser(input.identity);

    const predictions = await this.prisma.prediction.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ updatedAt: 'desc' }, { submittedAt: 'desc' }],
      select: PREDICTION_VIEW_SELECT,
    });

    return predictions.map((prediction) => this.toPredictionView(prediction));
  }

  private assertValidScores(homeScore: number, awayScore: number): void {
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      throw new BadRequestException('Scores must be non-negative integers');
    }
  }

  private toPredictionView(prediction: PredictionRecord): PredictionView {
    return {
      id: prediction.id,
      matchId: prediction.matchId,
      tournamentId: prediction.tournamentId,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
      pointsAwarded: prediction.pointsAwarded,
      scoringStatus: prediction.scoringStatus,
      submittedAt: prediction.submittedAt,
      updatedAt: prediction.updatedAt,
      scoredAt: prediction.scoredAt,
    };
  }
}
