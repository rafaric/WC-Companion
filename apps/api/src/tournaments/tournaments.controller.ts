import { Controller, Get } from '@nestjs/common';

import { TournamentsService } from './tournaments.service';
import type { TournamentMatchView, TournamentView } from './tournaments.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Get('active')
  async getActiveTournament(): Promise<TournamentView> {
    return this.tournamentsService.getActiveTournament();
  }

  @Get('active/matches')
  async getActiveTournamentMatches(): Promise<TournamentMatchView[]> {
    return this.tournamentsService.getActiveTournamentMatches();
  }
}
