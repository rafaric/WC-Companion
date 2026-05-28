# WorldPredict API - Production Dockerfile
# Build context: repo root (required for pnpm workspace)

FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

# Copy workspace config files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy API source
COPY apps/api ./apps/api

# Generate Prisma client and build (DATABASE_URL is required by prisma.config.ts but not used for generation)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" pnpm --filter @worldpredict/api prisma:generate
RUN pnpm --filter @worldpredict/api build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts, Prisma files, migrations, scripts, and node_modules from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/scripts/start.sh ./apps/api/scripts/start.sh
COPY --from=builder /app/node_modules ./node_modules

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "./scripts/start.sh"]
