import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RankingsService, type RankingRecalculationSummary } from '../rankings/rankings.service';
import { ScoringService, type ScoreFinalizedMatchSummary } from '../scoring/scoring.service';
import type { FinalizeMatchInput } from './dto/finalize-match.dto';

export interface FinalizeMatchSummary {
  matchId: string;
  tournamentId: string;
  scoringSummary: ScoreFinalizedMatchSummary;
  globalRankingSummary: RankingRecalculationSummary;
  groupRankingSummaries: RankingRecalculationSummary[];
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
    private readonly rankingsService: RankingsService,
  ) {}

  async finalizeMatch(input: FinalizeMatchInput): Promise<FinalizeMatchSummary> {
    const scores = this.normalizeScores(input.homeScore, input.awayScore);

    const match = await this.prisma.match.findUnique({
      where: { id: input.matchId },
      select: {
        id: true,
        tournamentId: true,
      },
    });

    if (match === null) {
      throw new NotFoundException(`Match ${input.matchId} was not found`);
    }

    const finalizedAt = new Date();

    // MVP orchestration: direct service calls keep the flow synchronous for now.
    // BullMQ should own this critical path in production later.
    const updatedMatch = await this.prisma.match.update({
      where: { id: input.matchId },
      data: {
        status: MatchStatus.FINISHED,
        homeScore: scores.homeScore,
        awayScore: scores.awayScore,
        finalizedAt,
      },
      select: {
        id: true,
        tournamentId: true,
      },
    });

    const scoringSummary = await this.scoringService.scoreFinalizedMatch(updatedMatch.id);
    const globalRankingSummary = await this.rankingsService.recalculateGlobalRanking(updatedMatch.tournamentId);
    const groups = await this.prisma.group.findMany({
      where: {
        tournamentId: updatedMatch.tournamentId,
      },
      select: {
        id: true,
      },
    });

    const groupRankingSummaries: RankingRecalculationSummary[] = [];

    for (const group of groups) {
      groupRankingSummaries.push(await this.rankingsService.recalculateGroupRanking(updatedMatch.tournamentId, group.id));
    }

    return {
      matchId: updatedMatch.id,
      tournamentId: updatedMatch.tournamentId,
      scoringSummary,
      globalRankingSummary,
      groupRankingSummaries,
    };
  }

  private normalizeScores(homeScore: unknown, awayScore: unknown): { homeScore: number; awayScore: number } {
    if (
      typeof homeScore !== 'number' ||
      typeof awayScore !== 'number' ||
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      throw new BadRequestException('Scores must be non-negative integers');
    }

    return { homeScore, awayScore };
  }
}
