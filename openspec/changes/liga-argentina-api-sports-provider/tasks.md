# Implementation Tasks — liga-argentina-api-sports-provider

## Review Workload Forecast

| Field                   | Value                                                  |
| ----------------------- | ------------------------------------------------------ |
| Estimated changed lines | ~650–750 (new + modified)                              |
| 400-line budget risk    | High                                                   |
| Chained PRs recommended | Yes                                                    |
| Suggested split         | PR 1 (client stack) → PR 2 (provider + wiring + tests) |
| Delivery strategy       | auto-chain                                             |
| Chain strategy          | stacked-to-main                                        |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

**Rationale**: The implementation spans ~6 new files (types, config, client, provider, 2 test files) plus 3 modified files. Test coverage alone accounts for ~370 lines. Production code is ~310 lines, modified code ~25 lines. Split into two autonomous work units: PR 1 covers the reusable HTTP client stack (types, config, client, client tests) which can be reviewed and merged independently; PR 2 covers the provider, module wiring, sync-service changes, and provider tests which depend on PR 1 being present.

---

## Phase 1: API-Sports Client Stack (PR 1)

### 1.1 Define api-sports raw response types

**File**: `apps/api/src/sports-data/api-sports.types.ts` (CREATE)

- Define `ApiSportsTournamentConfig` interface: `{ leagueId: number; season: number; displayName: string }`.
- Define `ApiSportsTournamentConfigMap` type: `Readonly<Record<string, ApiSportsTournamentConfig>>`.
- Define `ApiSportsClientOptions` interface: `{ baseUrl?: string; apiKey?: string; fetchImpl?: typeof fetch }`.
- Define `ApiSportsClientLike` interface with `listTeams(config)` and `listFixtures(config)` methods.
- Define raw response envelope types modeling only used fields:
  - `ApiSportsTeamApiResponse` → `team.id`, `team.name`, `team.code`, `team.country`
  - `ApiSportsTeamCollectionResponse` → `{ response: ApiSportsTeamApiResponse[] }`
  - `ApiSportsFixtureApiResponse` → `fixture.id`, `fixture.date`, `fixture.status.short`, `fixture.venue.{id,name,city}`, `league.round`, `teams.home.{id,name,code}`, `teams.away.{id,name,code}`, `goals.home`, `goals.away`
  - `ApiSportsFixtureCollectionResponse` → `{ response: ApiSportsFixtureApiResponse[] }`
- Keep types minimal — only fields consumed by the provider.

**Verification**:

- Run `npx tsc --noEmit --project apps/api/tsconfig.json` — must pass.

### 1.2 Define api-sports tournament configuration

**File**: `apps/api/src/sports-data/api-sports.config.ts` (CREATE)

- Export `API_SPORTS_TOURNAMENT_CONFIGS` as `const` with:
  - `"liga-argentina-2026"` → `{ leagueId: 128, season: 2026, displayName: "Liga Profesional Argentina 2026" }`.
- Type satisfies `ApiSportsTournamentConfigMap`.

**Verification**:

- Run `npx tsc --noEmit --project apps/api/tsconfig.json` — must pass.

### 1.3 Implement api-sports HTTP client

**File**: `apps/api/src/sports-data/api-sports.client.ts` (CREATE)

- Default base URL: `https://v3.football.api-sports.io`.
- Constructor accepts `ApiSportsClientOptions`.
- `buildTeamsPath(config)` → `/teams?league={leagueId}&season={season}`.
- `buildFixturesPath(config)` → `/fixtures?league={leagueId}&season={season}`.
- Private `request<T>(path)`:
  - Uses `fetchImpl` from options (falls back to global `fetch`).
  - Sends `Accept: application/json`.
  - Sends `x-apisports-key: <trimmed apiKey>` when present.
  - Throws `Error` on non-OK responses (matches football-data pattern).
- `listTeams(config)` → calls `/teams` endpoint, returns parsed response.
- `listFixtures(config)` → calls `/fixtures` endpoint, returns parsed response.
- Follow the exact pattern of `FootballDataClient` (private `request`, `createHeaders`, path builders).

**Verification**:

- Run `npx tsc --noEmit --project apps/api/tsconfig.json` — must pass.

### 1.4 RED — Write client test skeleton (fail)

**File**: `apps/api/src/sports-data/api-sports.client.spec.ts` (CREATE)

- Write failing test cases that import `ApiSportsClient` (which may not exist yet, or import the stub from 1.3):
  - `it('builds /teams path with league and season')`
  - `it('builds /fixtures path with league and season')`
  - `it('uses default base URL when no override')`
  - `it('honors API_SPORTS_BASE_URL override')`
  - `it('sends x-apisports-key header')`
  - `it('throws on non-OK response')`

**Verification**:

- Run `pnpm --filter api test -- --testPathPattern='api-sports.client.spec'` — tests should FAIL (RED) because assertions are written against not-yet-fully-implemented client, or they pass if 1.3 is already complete. If 1.3 is complete, tests should PASS.

### 1.5 GREEN — Complete client tests (pass)

- Implement all test cases in `api-sports.client.spec.ts` using mocked `fetchImpl` (same pattern as `football-data.client.spec.ts`).
- Verify each test passes individually.

**Verification**:

- Run `pnpm --filter api test -- --testPathPattern='api-sports.client.spec'` — all tests must PASS (GREEN).

### 1.6 TRIANGULATE — Add client edge-case tests

- Add test: `it('trims whitespace from api key')`.
- Add test: `it('omits x-apisports-key header when apiKey is empty/undefined'`.
- Add test: `it('encodes leagueId and season in query params')`.

**Verification**:

- Run `pnpm --filter api test -- --testPathPattern='api-sports.client.spec'` — all tests must PASS.

### 1.7 REFACTOR — Client code cleanup

- Ensure client code follows the same style as `FootballDataClient`.
- No duplicate code; shared utilities if any extracted appropriately.
- Run type-check one final time.

**Verification**:

- Run `npx tsc --noEmit --project apps/api/tsconfig.json` — must pass.
- Run `pnpm --filter api test -- --testPathPattern='api-sports.client.spec'` — all tests must PASS.

---

## Phase 2: Provider, Wiring & Sync Service (PR 2)

### 2.1 Add api-sports to provider constants

**File**: `apps/api/src/sports-data/sports-data.constants.ts` (MODIFY)

- Add `API_SPORTS: 'api-sports'` to `SPORTS_DATA_PROVIDER_KEYS` object.
- No other changes to this file.

**Verification**:

- Run `npx tsc --noEmit --project apps/api/tsconfig.json` — must pass.

### 2.2 Implement api-sports provider

**File**: `apps/api/src/sports-data/api-sports.provider.ts` (CREATE)

- `ApiSportsProvider implements SportsDataProvider`.
- `readonly providerKey: SportsDataProviderKey = SPORTS_DATA_PROVIDER_KEYS.API_SPORTS`.
- Constructor: `(client: ApiSportsClientLike, tournamentConfigs: ApiSportsTournamentConfigMap)`.
- Private `requireTournamentConfig(slug)` — throws if slug not in config map.
- `listTeams(slug)`:
  - Resolve config via slug.
  - Call `client.listTeams(config)`.
  - Map each `ApiSportsTeamApiResponse` to `SportsDataTeamDTO`:
    - `externalId` ← `String(team.id)`
    - `name` ← `team.name`
    - `shortName` ← fallback: `team.code` (trimmed) → acronym from name → sanitized first 3 chars.
    - `countryCode` ← `null`
    - `flagCode` ← `null`
    - `primaryColor` / `secondaryColor` ← `null`
- `listVenues(slug)`:
  - Call `client.listFixtures(config)`.
  - Extract `fixture.venue` from each fixture.
  - Skip fixtures with missing/invalid venue id or name.
  - Dedupe by `externalId` (use Map keyed by venue id).
  - Map to `SportsDataVenueDTO`:
    - `externalId` ← `String(venue.id)`
    - `name` ← `venue.name`
    - `city` ← `venue.city ?? null`
    - `countryCode` ← `null`
    - `capacity` ← `null`
- `listFixtures(slug)`:
  - Call `client.listFixtures(config)`.
  - Filter: skip fixtures missing either `teams.home.id` or `teams.away.id`.
  - Map each to `SportsDataFixtureDTO`:
    - `externalId` ← `String(fixture.id)`
    - `homeTeamExternalId` ← `String(teams.home.id)`
    - `awayTeamExternalId` ← `String(teams.away.id)`
    - `venueExternalId` ← `String(fixture.venue.id)` when present, else `null`
    - `kickoffAt` ← `new Date(fixture.date)` (throw on invalid date)
    - `stage` ← normalized from `league.round` (reuse football-data normalizer or implement similar)
    - `groupName` ← `null`
- `listFinalResults(slug)`:
  - Call `client.listFixtures(config)`.
  - Filter: only include where `fixture.status.short === 'FT'`.
  - Throw on FT fixtures missing numeric `goals.home` or `goals.away`.
  - Map each to `SportsDataFinalResultDTO`:
    - `externalMatchId` ← `String(fixture.id)`
    - `homeScore` ← `goals.home`
    - `awayScore` ← `goals.away`
    - `playedAt` ← `new Date(fixture.date)`

**Verification**:

- Run `npx tsc --noEmit --project apps/api/tsconfig.json` — must pass.

### 2.3 RED — Write provider test skeleton (fail)

**File**: `apps/api/src/sports-data/api-sports.provider.spec.ts` (CREATE)

- Write failing test stubs covering:
  - `it('exposes the api-sports provider key')`
  - `it('maps teams from raw api-sports response')`
  - `it('falls back short name when team.code is missing')`
  - `it('maps fixtures with team ids, venue ids, kickoff time, round label')`
  - `it('derives deduped venues from fixture venue payloads')`
  - `it('maps only FT fixtures to final results')`
  - `it('excludes non-FT fixtures from final results')`
  - `it('throws for unknown tournament slug')`
  - `it('throws for malformed FT score payloads')`

**Verification**:

- Run `pnpm --filter api test -- --testPathPattern='api-sports.provider.spec'` — tests should FAIL (RED) if provider implementation is incomplete.

### 2.4 GREEN — Complete provider tests (pass)

- Implement all test cases using `jest.Mocked<ApiSportsClientLike>` mock client (same pattern as `football-data.provider.spec.ts`).
- Use realistic api-sports response payloads for team, fixture, and venue data.
- Verify each test passes.

**Verification**:

- Run `pnpm --filter api test -- --testPathPattern='api-sports.provider.spec'` — all tests must PASS (GREEN).

### 2.5 TRIANGULATE — Add provider edge-case tests

- Add test: team short name fallback chain (code → acronym → sanitized prefix).
- Add test: venue deduplication when multiple fixtures share the same venue.
- Add test: fixture skipped when home team id is null.
- Add test: fixture skipped when away team id is null.
- Add test: date parsing throws on invalid date string.
- Add test: FT fixture with null scores throws.

**Verification**:

- Run `pnpm --filter api test -- --testPathPattern='api-sports.provider.spec'` — all tests must PASS.

### 2.6 Wire api-sports provider into SportsDataModule

**File**: `apps/api/src/sports-data/sports-data.module.ts` (MODIFY)

- Import `ApiSportsClient`, `ApiSportsProvider`, `API_SPORTS_TOURNAMENT_CONFIGS`, `SPORTS_DATA_PROVIDER_KEYS.API_SPORTS`.
- Extend `useFactory` in provider selection:
  - If `providerKey === 'api-sports'`: instantiate `ApiSportsProvider` with `ApiSportsClient` (configured with `API_SPORTS_API_KEY` and optional `API_SPORTS_BASE_URL`) and `API_SPORTS_TOURNAMENT_CONFIGS`.
  - Keep existing `football-data` and `mock` fallback branches unchanged.
- Factory return type must include `ApiSportsProvider` in the union.

**Verification**:

- Run `npx tsc --noEmit --project apps/api/tsconfig.json` — must pass.

### 2.7 Update sync service: tournament gating + provider key resolution

**File**: `apps/api/src/sports-data/sports-data-sync.service.ts` (MODIFY)

- Add `'liga-argentina-2026'` to `SUPPORTED_PROVIDER_TOURNAMENT_SLUGS` array.
- Update `resolveProviderTournamentKey()`:
  - Current: `football-data` → slug, else → tournament id.
  - New: `football-data` → slug, `api-sports` → slug, else → tournament id.
  - Implementation: check `this.provider.providerKey` against both `FOOTBALL_DATA` and `API_SPORTS` keys.

**Verification**:

- Run `npx tsc --noEmit --project apps/api/tsconfig.json` — must pass.

### 2.8 Update sync service tests: Liga gating + api-sports key resolution

**File**: `apps/api/src/sports-data/sports-data-sync.service.spec.ts` (MODIFY)

- Add test: `it('resolves the tournament slug before invoking an api-sports provider')` — mirrors the existing football-data slug resolution test but with `providerKey: 'api-sports'`.
- Add test: `it('allows liga-argentina-2026 for provider sync')` — verify that `importTournament('liga-arg-2026-id')` does NOT throw `ForbiddenException` when tournament slug is `liga-argentina-2026`.
- Add test: `it('still rejects unsupported tournaments for api-sports provider')` — demo/unknown slug still throws.

**Verification**:

- Run `pnpm --filter api test -- --testPathPattern='sports-data-sync.service.spec'` — all tests must PASS (including existing regression tests).

### 2.9 REFACTOR — Provider code cleanup

- Ensure provider code follows the same patterns as `FootballDataProvider`.
- Verify no unnecessary imports, no duplicate logic.
- Consider extracting shared `formatShortName` utility if api-sports and football-data logic diverge enough to warrant a shared helper (likely not needed if both stay in their respective providers).

**Verification**:

- Run `npx tsc --noEmit --project apps/api/tsconfig.json` — must pass.

---

## Phase 3: Regression & Integration Verification

### 3.1 Regression: existing tests pass unchanged

- Run the full sports-data test suite.

**Verification**:

- Run `pnpm --filter api test -- --testPathPattern='sports-data'` — all tests must PASS.
- Specifically confirm:
  - `football-data.client.spec.ts` — passes.
  - `football-data.provider.spec.ts` — passes.
  - `sports-data-sync.service.spec.ts` — all existing tests pass.

### 3.2 Full API test suite

**Verification**:

- Run `pnpm --filter api test` — must pass with no failures.
- If any pre-existing test failures exist, note them but do not fix (out of scope). Only new test failures caused by this change must be resolved.

### 3.3 Optional: Add env placeholder documentation

**Files**: `.env`, `apps/api/.env` (MODIFY — optional)

- Add commented placeholder lines:
  ```
  # API_SPORTS_API_KEY=       # Required when SPORTS_DATA_PROVIDER=api-sports
  # API_SPORTS_BASE_URL=      # Optional override for api-sports base URL
  ```
- Do NOT commit real keys.

---

## Task Dependency Graph

```
1.1 (types) ──┬── 1.2 (config) ──┬── 1.3 (client) ── 1.4 (client RED) ── 1.5 (client GREEN) ── 1.6 (triangulate) ── 1.7 (refactor)
              │                  │
              │                  └── 2.2 (provider) ── 2.3 (provider RED) ── 2.4 (provider GREEN) ── 2.5 (triangulate)
              │
              └── 2.1 (constants) ── 2.6 (module wiring) ── 2.7 (sync service) ── 2.8 (sync tests)
                                                  │
                                                  └── 2.9 (refactor)
                                                             │
                                                             └── 3.1 (regression tests) ── 3.2 (full suite) ── 3.3 (env docs, optional)
```

## PR Split Plan

### PR 1: API-Sports Client Stack (Phases 1.1–1.7)

- **Files**: `api-sports.types.ts`, `api-sports.config.ts`, `api-sports.client.ts`, `api-sports.client.spec.ts`
- **Scope**: Types, config, HTTP client, and client tests. No module wiring or provider logic.
- **Verification**: `tsc` + client spec tests pass.
- **Estimated lines**: ~280

### PR 2: Provider, Wiring & Sync Service (Phases 2.1–2.9, 3.1–3.3)

- **Files**: `sports-data.constants.ts` (mod), `api-sports.provider.ts`, `api-sports.provider.spec.ts`, `sports-data.module.ts` (mod), `sports-data-sync.service.ts` (mod), `sports-data-sync.service.spec.ts` (mod), `.env` (optional)
- **Scope**: Provider implementation, provider tests, module wiring, sync service updates, regression tests.
- **Verification**: `tsc` + all sports-data tests pass.
- **Estimated lines**: ~420
