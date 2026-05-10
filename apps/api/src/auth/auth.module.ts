import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { AUTH0_JWT_STRATEGY_NAME } from './auth.constants';
import { Auth0JwtGuard } from './auth.guard';
import { Auth0JwtStrategy } from './auth0-jwt.strategy';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: AUTH0_JWT_STRATEGY_NAME })],
  providers: [AuthService, Auth0JwtStrategy, Auth0JwtGuard, PermissionsGuard],
  exports: [AuthService, Auth0JwtGuard, PermissionsGuard],
})
export class AuthModule {}
