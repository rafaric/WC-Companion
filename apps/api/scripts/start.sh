#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy

echo "Starting server..."
node dist/main
