export interface AppEnv {
  PORT: number;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  WEB_ORIGIN: string;
  CORS_ORIGINS: string[];
}

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';
const DEFAULT_CORS_ORIGINS = [DEFAULT_WEB_ORIGIN, 'http://127.0.0.1:3000'] as const;

function requireString(value: unknown, key: string): string {
  const rawValue = typeof value === 'string' ? value : undefined;
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return trimmed;
}

function requireOrigin(value: unknown, key: string): string {
  const candidate = requireString(value, key);

  try {
    return new URL(candidate).origin;
  } catch {
    throw new Error(`Invalid origin for environment variable: ${key}`);
  }
}

function parseOrigins(value: unknown, fallbackOrigins: readonly string[]): string[] {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  const candidates = rawValue.length > 0 ? rawValue.split(',') : [...fallbackOrigins];
  const origins = candidates
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0)
    .map((candidate) => requireOrigin(candidate, 'CORS_ORIGINS'));

  return [...new Set(origins)];
}

function requirePort(value: unknown, key: string): number {
  const parsed = Number.parseInt(requireString(value, key), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid port for environment variable: ${key}`);
  }

  return parsed;
}

export function validateEnv(env: Record<string, unknown>): AppEnv {
  const webOrigin = requireOrigin(env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN, 'WEB_ORIGIN');

  return {
    PORT: requirePort(env.PORT, 'PORT'),
    DATABASE_URL: requireString(env.DATABASE_URL, 'DATABASE_URL'),
    REDIS_HOST: requireString(env.REDIS_HOST, 'REDIS_HOST'),
    REDIS_PORT: requirePort(env.REDIS_PORT, 'REDIS_PORT'),
    AUTH0_DOMAIN: requireString(env.AUTH0_DOMAIN, 'AUTH0_DOMAIN'),
    AUTH0_AUDIENCE: requireString(env.AUTH0_AUDIENCE, 'AUTH0_AUDIENCE'),
    WEB_ORIGIN: webOrigin,
    CORS_ORIGINS: parseOrigins(env.CORS_ORIGINS, [webOrigin, ...DEFAULT_CORS_ORIGINS]),
  };
}
