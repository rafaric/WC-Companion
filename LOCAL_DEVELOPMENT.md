# WorldPredict — Local Development

## Purpose

This project supports two infrastructure setup modes:

1. **Local development without Docker** — recommended for this development machine.
2. **Docker-based services** — kept for production-like environments or machines where Docker is available.

Docker is **not required** for local development.

## Prerequisites

### Required

- Node.js
- pnpm
- PostgreSQL 16+
- Redis 7+

### Install pnpm

Recommended via Corepack:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm --version
```

If Corepack is unavailable, install pnpm using the official pnpm installation method.

## Local Setup Without Docker

### 1. Install PostgreSQL and Redis

Using Homebrew on macOS:

```bash
brew install postgresql@16 redis
```

Start services:

```bash
brew services start postgresql@16
brew services start redis
```

Check Redis:

```bash
redis-cli ping
```

Expected response:

```txt
PONG
```

### 2. Create local PostgreSQL database and user

The local `.env` example assumes:

```txt
database: worldpredict
user: worldpredict
password: worldpredict
host: localhost
port: 5432
```

One possible setup:

```bash
createuser worldpredict
createdb worldpredict --owner=worldpredict
psql postgres
```

Inside `psql`, set a password:

```sql
ALTER USER worldpredict WITH PASSWORD 'worldpredict';
\q
```

If your local PostgreSQL uses a different auth method or user, adjust `DATABASE_URL` accordingly.

### 3. Configure environment variables

Copy the example file:

```bash
cp .env.example .env
```

Prisma commands run from `apps/api`, so also make the same environment available to the API app:

```bash
cp .env apps/api/.env
```

This avoids Prisma errors like:

```txt
Environment variable not found: DATABASE_URL
```

Recommended local values:

```env
DATABASE_URL="postgresql://worldpredict:worldpredict@localhost:5432/worldpredict?schema=public"
REDIS_HOST="localhost"
REDIS_PORT="6379"
AUTH0_DOMAIN="your-auth0-domain"
AUTH0_AUDIENCE="your-auth0-api-audience"
PORT="3001"
```

Auth0 values can be placeholders until Auth0 is configured, but authenticated endpoints will not work correctly without real values.

### 4. Install dependencies

```bash
pnpm install
```

### 5. Generate Prisma client

```bash
pnpm prisma:generate
```

### 6. Run the first migration

```bash
pnpm prisma:migrate
```

### 7. Start API in development mode

```bash
pnpm api:dev
```

## Docker-based Setup

Docker configuration is kept for production-like environments or developers who can use Docker.

Start PostgreSQL and Redis with Docker:

```bash
pnpm db:docker:up
```

Stop Docker services:

```bash
pnpm db:docker:down
```

The Docker services expose:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Important Notes

### Docker is optional locally

Do not assume `docker compose` is available on every development machine.

Use local PostgreSQL and Redis when Docker is unavailable.

### Keep production parity where practical

Even without Docker locally, keep versions close to production expectations:

- PostgreSQL 16+
- Redis 7+

### Do not calculate official scoring on the frontend

The backend owns official scoring and ranking updates.

Frontend may display optimistic feedback, but persisted points and ranking positions must come from the API.

## Smoke verification

Run the full MVP backend loop against the local database:

```bash
pnpm smoke:mvp
```

This uses smoke-owned users, a smoke group, and a dedicated smoke match so the flow can be rerun safely without touching non-smoke data.
