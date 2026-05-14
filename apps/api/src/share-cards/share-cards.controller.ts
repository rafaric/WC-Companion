import { Controller, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Auth0JwtGuard } from '../auth/auth.guard';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedIdentity } from '../auth/auth.types';
import { ShareCardsService, type ShareCardView } from './share-cards.service';

interface TournamentContextQuery {
  tournamentId?: string | null;
  tournamentSlug?: string | null;
}

@UseGuards(Auth0JwtGuard)
@Controller('share-cards')
export class ShareCardsController {
  constructor(private readonly shareCardsService: ShareCardsService) {}

  @Post('me/global-ranking')
  async createMyGlobalRankingShareCard(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Query() query: TournamentContextQuery,
  ): Promise<ShareCardView> {
    return this.shareCardsService.createMyGlobalRankingShareCard(identity, {
      explicitTournamentId: query.tournamentId,
      selectedSlug: query.tournamentSlug,
    });
  }

  @Post('groups/:groupId/ranking')
  async createGroupRankingShareCard(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('groupId') groupId: string,
  ): Promise<ShareCardView> {
    return this.shareCardsService.createGroupRankingShareCard(identity, groupId);
  }

  @Post('predictions/matches/:matchId')
  async createPredictionShareCard(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('matchId') matchId: string,
  ): Promise<ShareCardView> {
    return this.shareCardsService.createPredictionShareCard(identity, matchId);
  }
}
