import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, TournamentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Input for tournament context resolution.
 * Resolution order: explicitTournamentId -> selectedSlug -> ACTIVE fallback
 */
export interface TournamentContextInput {
  /** Explicit tournament ID (from admin writes or path params) */
  explicitTournamentId?: string | null;
  /** Selected tournament slug (from cookie/header) */
  selectedSlug?: string | null;
}

/**
 * Resolved tournament context with source metadata.
 */
export interface ResolvedTournamentContext {
  tournament: TournamentView;
  /** How the tournament was resolved: 'explicit' | 'cookie' | 'active' */
  source: 'explicit' | 'cookie' | 'active';
}

export interface TournamentView {
  id: string;
  name: string;
  slug: string;
  year: number;
  status: TournamentStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface TeamColorsView {
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface TeamView {
  id: string;
  name: string;
  shortName: string;
  countryCode: string | null;
  flagCode: string | null;
  colors: TeamColorsView;
}

export interface TournamentMatchView {
  id: string;
  tournamentId: string;
  stage: string | null;
  groupName: string | null;
  kickoffAt: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  finalizedAt: Date | null;
  homeTeam: TeamView;
  awayTeam: TeamView;
}

interface ActiveTournamentRecord {
  id: string;
  name: string;
  slug: string;
  year: number;
  status: TournamentStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}

interface ActiveTournamentMatchRecord {
  id: string;
  tournamentId: string;
  stage: string | null;
  groupName: string | null;
  kickoffAt: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  finalizedAt: Date | null;
  homeTeam: {
    id: string;
    name: string;
    shortName: string;
    countryCode: string | null;
    flagCode: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string;
    countryCode: string | null;
    flagCode: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  };
}

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveTournament(): Promise<TournamentView> {
    const tournament = await this.prisma.tournament.findFirst({
      where: {
        status: TournamentStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        year: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (tournament === null) {
      throw new NotFoundException('Active tournament not found');
    }

    return this.toTournamentView(tournament);
  }

  async getActiveTournamentMatches(): Promise<TournamentMatchView[]> {
    const tournament = await this.getActiveTournament();
    return this.getTournamentMatches(tournament.id);
  }

  /**
   * Get matches for a specific tournament by ID.
   */
  async getTournamentMatches(tournamentId: string): Promise<TournamentMatchView[]> {
    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
      },
      orderBy: {
        kickoffAt: 'asc',
      },
      select: {
        id: true,
        tournamentId: true,
        stage: true,
        groupName: true,
        kickoffAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        finalizedAt: true,
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            countryCode: true,
            flagCode: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            countryCode: true,
            flagCode: true,
            primaryColor: true,
            secondaryColor: true,
          },
        },
      },
    });

    return matches.map((match) => this.toTournamentMatchView(match));
  }

  /**
   * Lists all tournaments for selector UI.
   */
  async listTournaments(): Promise<TournamentView[]> {
    const tournaments = await this.prisma.tournament.findMany({
      orderBy: [
        { status: 'desc' }, // ACTIVE first
        { year: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        year: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });

    return tournaments.map((tournament) => this.toTournamentView(tournament));
  }

  /**
   * Resolves tournament context from input.
   * Resolution order: explicitTournamentId -> selectedSlug -> ACTIVE fallback
   */
  async resolveTournamentContext(input: TournamentContextInput): Promise<ResolvedTournamentContext> {
    // Step 1: Try explicit tournament ID
    if (input.explicitTournamentId !== undefined && input.explicitTournamentId !== null && input.explicitTournamentId !== '') {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: input.explicitTournamentId },
        select: {
          id: true,
          name: true,
          slug: true,
          year: true,
          status: true,
          startsAt: true,
          endsAt: true,
        },
      });

      if (tournament === null) {
        throw new NotFoundException(`Tournament ${input.explicitTournamentId} was not found`);
      }

      return {
        tournament: this.toTournamentView(tournament),
        source: 'explicit',
      };
    }

    // Step 2: Try selected slug from cookie
    if (input.selectedSlug !== undefined && input.selectedSlug !== null && input.selectedSlug !== '') {
      const tournament = await this.prisma.tournament.findFirst({
        where: { slug: input.selectedSlug },
        select: {
          id: true,
          name: true,
          slug: true,
          year: true,
          status: true,
          startsAt: true,
          endsAt: true,
        },
      });

      if (tournament !== null) {
        return {
          tournament: this.toTournamentView(tournament),
          source: 'cookie',
        };
      }

      // Invalid slug - log warning and fall through to ACTIVE
    }

    // Step 3: Fall back to ACTIVE tournament
    const activeTournament = await this.getActiveTournament();
    return {
      tournament: activeTournament,
      source: 'active',
    };
  }

  /**
   * Gets the active tournament (strict - no fallback).
   * Use resolveTournamentContext() for context-aware resolution.
   */
  async getStrictActiveTournament(): Promise<TournamentView> {
    return this.getActiveTournament();
  }

  private toTournamentView(tournament: ActiveTournamentRecord): TournamentView {
    return {
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      year: tournament.year,
      status: tournament.status,
      startsAt: tournament.startsAt,
      endsAt: tournament.endsAt,
    };
  }

  private toTeamView(team: ActiveTournamentMatchRecord['homeTeam']): TeamView {
    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      countryCode: team.countryCode,
      flagCode: team.flagCode,
      colors: {
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
      },
    };
  }

  private toTournamentMatchView(match: ActiveTournamentMatchRecord): TournamentMatchView {
    return {
      id: match.id,
      tournamentId: match.tournamentId,
      stage: match.stage,
      groupName: match.groupName,
      kickoffAt: match.kickoffAt,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      finalizedAt: match.finalizedAt,
      homeTeam: this.toTeamView(match.homeTeam),
      awayTeam: this.toTeamView(match.awayTeam),
    };
  }
}
