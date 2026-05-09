import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';

import { Auth0JwtGuard } from '../auth/auth.guard';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedIdentity } from '../auth/auth.types';
import { UpdateCurrentUserProfileDto } from './dto/update-current-user-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(Auth0JwtGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@CurrentAuthUser() identity: AuthenticatedIdentity) {
    return this.usersService.getCurrentUser(identity);
  }

  @Patch('me/profile')
  async updateCurrentUserProfile(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Body() body: UpdateCurrentUserProfileDto,
  ) {
    return this.usersService.updateCurrentUserProfile(identity, body);
  }
}
