import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

import type { AppEnv } from '../config/env.validation';
import { AUTH0_JWT_STRATEGY_NAME } from './auth.constants';
import { AuthService } from './auth.service';
import type { Auth0JwtPayload, AuthenticatedIdentity } from './auth.types';

@Injectable()
export class Auth0JwtStrategy extends PassportStrategy(Strategy, AUTH0_JWT_STRATEGY_NAME) {
  constructor(
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly authService: AuthService,
  ) {
    const auth0Domain = configService.getOrThrow('AUTH0_DOMAIN');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      audience: configService.getOrThrow('AUTH0_AUDIENCE'),
      issuer: `https://${auth0Domain}/`,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
      }),
    });
  }

  validate(payload: Auth0JwtPayload): AuthenticatedIdentity {
    return this.authService.normalizeIdentity(payload);
  }
}
