import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

interface PrismaEnvironment {
  DATABASE_URL: string;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --project tsconfig.json --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: env<PrismaEnvironment>('DATABASE_URL'),
  },
});
