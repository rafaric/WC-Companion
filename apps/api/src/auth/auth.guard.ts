import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AUTH0_JWT_STRATEGY_NAME } from './auth.constants';

@Injectable()
export class Auth0JwtGuard extends AuthGuard(AUTH0_JWT_STRATEGY_NAME) {
  override handleRequest<TUser>(error: Error | null, user: TUser | null): TUser {
    if (error || !user) {
      throw error ?? new UnauthorizedException('Invalid Auth0 access token');
    }

    return user;
  }
}
