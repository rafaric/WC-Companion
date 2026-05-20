# SDD Explore — feat(api): add api-sports provider for Liga Argentina mode

## status
`explore_complete`

## executive_summary
The existing `sports-data` module already has a clean provider abstraction (`SportsDataProvider`) with a single real implementation (`FootballDataProvider`) and a mock fallback. Adding an `api-sports.io` provider for Liga Argentina requires:
1. Extending `SPORTS_DATA_PROVIDER_KEYS` with `api-sports`.
2. Creating `ApiSportsClient`, `ApiSportsProvider`, and `ApiSportsTournamentConfig` following the established football-data patterns.
3. Wiring the new provider into `SportsDataModule` via `ConfigService` (reading `SPORTS_DATA_PROVIDER=api-sports` and `API_SPORTS_API_KEY`).
4. Adding `liga-argentina-2026` to `SUPPORTED_PROVIDER_TOURNAMENT_SLUGS` in `SportsDataSyncService`.
5. Mapping `api-sports.io` response shapes (fixtures, teams, scores) into the shared DTOs, filtering final results by `fixture.status.short === "FT"`.

No schema migrations, frontend changes, or BullMQ assumptions are needed for this slice. The existing `syncResults()` staging flow is provider-agnostic and will remain idempotent.

---

## relevant_current_architecture

### 1. Provider abstraction
- **File:** `apps/api/src/sports-data/sports-data.types.ts`
- **Interface:** `SportsDataProvider`
  - `listTeams(tournamentId: string) => SportsDataTeamDTO[]`
  - `listVenues(tournamentId: string) => SportsDataVenueDTO[]`
  - `listFixtures(tournamentId: string) => SportsDataFixtureDTO[]`
  - `listFinalResults(tournamentId: string) => SportsDataFinalResultDTO[]`

### 2. Provider constants & injection token
- **File:** `apps/api/src/sports-data/sports-data.constants.ts`
- `SPORTS_DATA_PROVIDER_KEYS = { MOCK: 'mock', FOOTBALL_DATA: 'football-data' }`
- `SPORTS_DATA_PROVIDER = Symbol('SPORTS_DATA_PROVIDER')`

### 3. Module factory wiring
- **File:** `apps/api/src/sports-data/sports-data.module.ts`
- Uses `useFactory` with `ConfigService` to select provider:
  - `SPORTS_DATA_PROVIDER=football-data` → `FootballDataProvider`
  - fallback → `MockSportsDataProvider`
- Reads `FOOTBALL_DATA_BASE_URL` and `FOOTBALL_DATA_API_TOKEN` from `ConfigService` **without** `validateEnv` participation (they are optional at boot).

### 4. Football-data reference implementation pattern
- **Client:** `football-data.client.ts` — wraps native `fetch`, builds paths, injects `X-Auth-Token`.
- **Types:** `football-data.types.ts` — raw API response types.
- **Provider:** `football-data.provider.ts` — maps raw responses to `SportsData*DTO`, normalizes stage/group names.
- **Config:** `football-data.config.ts` — tournament slug → `{ competitionId, season, displayName }`.

### 5. Sync service & tournament gating
- **File:** `apps/api/src/sports-data/sports-data-sync.service.ts`
- `SUPPORTED_PROVIDER_TOURNAMENT_SLUGS = ['world-cup-2026']` guards provider sync ops for non-fallback tournaments.
- `resolveProviderTournamentKey()` uses `tournament.slug` for `football-data`, otherwise `tournament.id`.

### 6. Env / config patterns
- **Validation:** `apps/api/src/config/env.validation.ts` defines `AppEnv`; only core infra vars are validated.
- **Current `.env` entries:**
  - `SPORTS_DATA_PROVIDER=football-data`
  - `FOOTBALL_DATA_API_TOKEN=...`
  - `FOOTBALL_DATA_BASE_URL=...`

### 7. Testing patterns
- **Client tests:** mock `fetch` via constructor option `fetchImpl`.
- **Provider tests:** mock client interface via `jest.Mocked<ClientLike>`; assert DTO mapping.
- **Sync service tests:** use `MockSportsDataProvider` snapshots; test idempotent staging/confirmation logic.

---

## proposed_change_boundary

### In-scope
- Add `API_SPORTS` to `SPORTS_DATA_PROVIDER_KEYS`.
- Create `api-sports.types.ts`, `api-sports.client.ts`, `api-sports.provider.ts`, `api-sports.config.ts`.
- Implement `ApiSportsProvider` conforming to `SportsDataProvider`.
- Map api-sports fixtures endpoint (`/fixtures?league={leagueId}&season={season}`) to DTOs.
- Filter final results: only fixtures where `fixture.status.short === "FT"` become `SportsDataFinalResultDTO`.
- Add `API_SPORTS_API_KEY` (and optional `API_SPORTS_BASE_URL`) env reads in module factory.
- Extend `SUPPORTED_PROVIDER_TOURNAMENT_SLUGS` to include `'liga-argentina-2026'`.
- Add `ApiSportsProvider` to `sports-data.module.ts` factory.
- Add unit tests for client and provider following football-data conventions.
- Preserve football-data and mock behavior (no regression).

### Out-of-scope
- No frontend branding mode (Slice 2).
- No automatic scheduled sync / BullMQ (Slice 3).
- No new Prisma schema migrations.
- No Liga Argentina tournament seed data (assumes tournament already exists or is seeded separately).
- No multi-provider runtime (one provider per deployment).

---

## risks / open_questions

| # | Risk / Question | Mitigation / Note |
|---|----------------|-------------------|
| 1 | **api-sports response shape variance** | The v3 API wraps lists in `response: T[]`. Need to confirm exact `fixture.teams`, `fixture.goals`, `fixture.score` nesting for Liga Argentina fixtures. |
| 2 | **Venue coverage** | api-sports returns `fixture.venue`; we can map it to `SportsDataVenueDTO` unlike football-data which currently returns `[]`. |
| 3 | **Short name / TLA** | api-sports `team.name` has no guaranteed TLA. Need a fallback short-name generator (reuse football-data logic or use `team.code`). |
| 4 | **Rate limits & request counts** | api-sports free tier has daily caps. Document expected usage; consider caching later. |
| 5 | **Season year for Liga Argentina 2026** | Config needs `season: 2026` alongside `leagueId: 128`. Confirm season alignment with api-sports. |
| 6 | **Tournament slug gating** | `SUPPORTED_PROVIDER_TOURNAMENT_SLUGS` currently hardcodes `['world-cup-2026']`. Adding `liga-argentina-2026` is trivial but must not accidentally enable sync for demo tournaments. |
| 7 | **Env var validation** | `AppEnv` does not currently validate sports-data vars. Should we add optional typed entries for consistency? Recommended: keep optional (match football-data pattern) to avoid breaking existing deployments that only use mock. |

---

## likely_files

| File | Action | Rationale |
|------|--------|-----------|
| `apps/api/src/sports-data/sports-data.constants.ts` | Modify | Add `API_SPORTS: 'api-sports'` key. |
| `apps/api/src/sports-data/sports-data.module.ts` | Modify | Extend factory to instantiate `ApiSportsProvider` when `SPORTS_DATA_PROVIDER=api-sports`. |
| `apps/api/src/sports-data/sports-data-sync.service.ts` | Modify | Add `liga-argentina-2026` to `SUPPORTED_PROVIDER_TOURNAMENT_SLUGS`. |
| `apps/api/src/sports-data/api-sports.types.ts` | Create | Raw API response types for api-sports v3. |
| `apps/api/src/sports-data/api-sports.client.ts` | Create | `fetch`-based HTTP client with `x-apisports-key` header. |
| `apps/api/src/sports-data/api-sports.provider.ts` | Create | `ApiSportsProvider implements SportsDataProvider`; maps responses to DTOs. |
| `apps/api/src/sports-data/api-sports.config.ts` | Create | Tournament slug → `{ leagueId, season, displayName }` map. |
| `apps/api/src/sports-data/api-sports.client.spec.ts` | Create | Unit tests for path building and auth header injection. |
| `apps/api/src/sports-data/api-sports.provider.spec.ts` | Create | Unit tests for DTO mapping and `FT` filtering. |
| `.env` (root & `apps/api/.env`) | Modify (example only) | Add `API_SPORTS_API_KEY=` placeholder (do not commit real keys). |

---

## recommended_change_id
`liga-argentina-api-sports-provider`

## next_recommended
`spec` phase — produce:
1. `api-sports` client/provider interface contract.
2. Exact DTO mapping spec (Given/When/Then) for teams, venues, fixtures, final-results.
3. Env var contract (`API_SPORTS_API_KEY`, optional `API_SPORTS_BASE_URL`).
4. Tournament config map spec for `liga-argentina-2026`.

## skill_resolution
`injected` — Project Standards (`openspec/config.yaml`) were provided in the session context; no independent registry loading was performed.
