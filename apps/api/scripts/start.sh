#!/bin/sh

echo "Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy || echo "Migration failed, continuing startup..."

echo "Starting server..."
node dist/main
