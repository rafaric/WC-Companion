#!/bin/sh

echo "Starting server..."
cd /app/apps/api

# Run migrations if DATABASE_URL is available
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL is set, running migrations..."
  prisma migrate deploy --schema=/app/apps/api/prisma/schema.prisma 2>&1 || echo "Migration step failed (this is OK if tables already exist)"
else
  echo "WARNING: DATABASE_URL is not set, skipping migrations"
fi

echo "Starting NestJS application..."
node dist/main
