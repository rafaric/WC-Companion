import { Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, TournamentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

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

    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId: tournament.id,
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
