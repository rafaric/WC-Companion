import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { Auth0JwtGuard } from '../auth/auth.guard';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedIdentity } from '../auth/auth.types';
import { RankingsService, type RankingEntryView } from '../rankings/rankings.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { GroupsService } from './groups.service';

interface TournamentContextQuery {
  tournamentId?: string | null;
  tournamentSlug?: string | null;
}

@UseGuards(Auth0JwtGuard)
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly rankingsService: RankingsService,
  ) {}

  @Post()
  async createGroup(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Body() body: CreateGroupDto,
    @Query() query: TournamentContextQuery,
  ) {
    return this.groupsService.createGroup({
      identity,
      name: body.name,
      tournamentContext: {
        explicitTournamentId: query.tournamentId,
        selectedSlug: query.tournamentSlug,
      },
    });
  }

  @Post('join')
  async joinGroup(@CurrentAuthUser() identity: AuthenticatedIdentity, @Body() body: JoinGroupDto) {
    return this.groupsService.joinGroup({
      identity,
      inviteCode: body.inviteCode,
    });
  }

  @Get('me')
  async getMyGroups(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Query() query: TournamentContextQuery,
  ) {
    return this.groupsService.getMyGroups({
      identity,
      tournamentContext: {
        explicitTournamentId: query.tournamentId,
        selectedSlug: query.tournamentSlug,
      },
    });
  }

  @Get(':groupId/ranking')
  async getGroupRanking(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('groupId') groupId: string,
  ): Promise<RankingEntryView[]> {
    return this.rankingsService.getGroupRanking({
      identity,
      groupId,
    });
  }
}
