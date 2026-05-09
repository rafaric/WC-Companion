import { Injectable } from '@nestjs/common';

import type { Auth0JwtPayload, AuthenticatedIdentity } from './auth.types';

@Injectable()
export class AuthService {
  normalizeIdentity(payload: Auth0JwtPayload): AuthenticatedIdentity {
    return {
      authSubject: payload.sub,
      email: payload.email ?? null,
      name: payload.name ?? null,
      nickname: payload.nickname ?? null,
      picture: payload.picture ?? null,
      permissions: payload.permissions ?? [],
    };
  }
}
