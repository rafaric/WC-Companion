import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { Auth0JwtGuard } from '../auth/auth.guard';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedIdentity } from '../auth/auth.types';
import { RankingsService, type RankingEntryView } from '../rankings/rankings.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { GroupsService } from './groups.service';

@UseGuards(Auth0JwtGuard)
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly rankingsService: RankingsService,
  ) {}

  @Post()
  async createGroup(@CurrentAuthUser() identity: AuthenticatedIdentity, @Body() body: CreateGroupDto) {
    return this.groupsService.createGroup({
      identity,
      name: body.name,
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
  async getMyGroups(@CurrentAuthUser() identity: AuthenticatedIdentity) {
    return this.groupsService.getMyGroups({ identity });
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
