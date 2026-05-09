export interface AppEnv {
  PORT: number;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
}

function requireString(value: unknown, key: string): string {
  const rawValue = typeof value === 'string' ? value : undefined;
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return trimmed;
}

function requirePort(value: unknown, key: string): number {
  const parsed = Number.parseInt(requireString(value, key), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid port for environment variable: ${key}`);
  }

  return parsed;
}

export function validateEnv(env: Record<string, unknown>): AppEnv {
  return {
    PORT: requirePort(env.PORT, 'PORT'),
    DATABASE_URL: requireString(env.DATABASE_URL, 'DATABASE_URL'),
    REDIS_HOST: requireString(env.REDIS_HOST, 'REDIS_HOST'),
    REDIS_PORT: requirePort(env.REDIS_PORT, 'REDIS_PORT'),
    AUTH0_DOMAIN: requireString(env.AUTH0_DOMAIN, 'AUTH0_DOMAIN'),
    AUTH0_AUDIENCE: requireString(env.AUTH0_AUDIENCE, 'AUTH0_AUDIENCE'),
  };
}
