import type { Request } from 'express';

export interface Auth0JwtPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  email?: string;
  name?: string;
  nickname?: string;
  picture?: string;
  scope?: string;
  permissions?: string[];
}

export interface AuthenticatedIdentity {
  authSubject: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  picture: string | null;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedIdentity;
}
