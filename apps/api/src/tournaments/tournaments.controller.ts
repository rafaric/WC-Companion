import { Controller, Get, Query } from '@nestjs/common';

import { TournamentsService, type TournamentMatchView, type TournamentView } from './tournaments.service';

/**
 * Query parameters for tournament context resolution.
 * These can come from cookie header or query string.
 */
export interface TournamentContextQuery {
  /** Explicit tournament ID (optional) */
  tournamentId?: string | null;
  /** Selected tournament slug from cookie (optional) */
  tournamentSlug?: string | null;
}

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  /**
   * List all tournaments for selector UI.
   */
  @Get()
  async listTournaments(): Promise<TournamentView[]> {
    return this.tournamentsService.listTournaments();
  }

  /**
   * Get the current tournament (resolved from context or ACTIVE fallback).
   */
  @Get('active')
  async getActiveTournament(@Query() query: TournamentContextQuery): Promise<TournamentView> {
    const context = await this.tournamentsService.resolveTournamentContext({
      explicitTournamentId: query.tournamentId,
      selectedSlug: query.tournamentSlug,
    });
    return context.tournament;
  }

  /**
   * Get matches for the current tournament (resolved from context or ACTIVE fallback).
   */
  @Get('active/matches')
  async getActiveTournamentMatches(@Query() query: TournamentContextQuery): Promise<TournamentMatchView[]> {
    const context = await this.tournamentsService.resolveTournamentContext({
      explicitTournamentId: query.tournamentId,
      selectedSlug: query.tournamentSlug,
    });

    const matches = await this.tournamentsService.getTournamentMatches(context.tournament.id);
    return matches;
  }
}
