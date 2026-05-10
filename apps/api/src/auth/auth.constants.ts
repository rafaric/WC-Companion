export const AUTH_PROVIDERS = {
  AUTH0: 'auth0',
} as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];

export const AUTH0_JWT_STRATEGY_NAME = 'auth0-jwt';

export const AUTH_PERMISSION_METADATA_KEYS = {
  REQUIRED_PERMISSIONS: 'auth:required-permissions',
} as const;

export const AUTH_PERMISSIONS = {
  MATCHES_FINALIZE: 'matches:finalize',
} as const;
