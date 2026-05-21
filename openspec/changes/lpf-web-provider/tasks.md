# Tasks — LPF Website Provider

## Review workload forecast

| Field                   | Value                                         |
| ----------------------- | --------------------------------------------- |
| Estimated changed lines | ~600–800                                      |
| 400-line budget risk    | High                                          |
| Chained PRs recommended | Yes                                           |
| Suggested split         | PR1 parser/client stack → PR2 provider+wiring |

Decision needed before apply: yes — whether to split. Recommended: split into two PRs.

## Phase 1 — Parser/client stack

### 1.1 Add LPF web types

Create `apps/api/src/sports-data/lpf-web.types.ts` with:

- `LpfWebTournamentConfig`
- `LpfWebTournamentConfigMap`
- `LpfWebClientOptions`
- `LpfWebClientLike`
- `LpfWebMatchRow`
- parser diagnostic/result types if needed

### 1.2 Add LPF tournament config

Create `apps/api/src/sports-data/lpf-web.config.ts` with:

- `liga-argentina-2026`
- default URL: `https://www.ligaprofesional.ar/torneo-apertura-2026/`

### 1.3 Add LPF web client

Create `lpf-web.client.ts`:

- injectable `fetchImpl`
- default/override URL handling
- non-OK response error
- returns page text/html

### 1.4 Add parser

Create `lpf-web.parser.ts`:

- extract fixture section
- parse date headings
- parse `TC` rows
- parse/detect `TE+P` rows
- attach venue line when available
- stop before standings/promedios sections

### 1.5 Add client/parser tests

Create:

- `lpf-web.client.spec.ts`
- `lpf-web.parser.spec.ts`

Tests must use representative page samples, not live network.

### 1.6 Verify PR1

Run:

```bash
apps/api/node_modules/.bin/tsc --noEmit --project apps/api/tsconfig.json --pretty false
cd apps/api && pnpm exec jest --runInBand src/sports-data/lpf-web.client.spec.ts src/sports-data/lpf-web.parser.spec.ts
```

## Phase 2 — Provider and wiring

### 2.1 Add provider key

Modify `sports-data.constants.ts`:

- add `LPF_WEB: "lpf-web"`

### 2.2 Implement provider

Create `lpf-web.provider.ts`:

- `providerKey = LPF_WEB`
- `listTeams()` from distinct parsed team names
- `listVenues()` from distinct parsed venue names
- `listFixtures()` from parsed rows
- `listFinalResults()` only for `status === "TC"`
- skip `TE+P` from final results
- unknown slug throws clear not-found error

### 2.3 Wire module

Modify `sports-data.module.ts`:

- when `SPORTS_DATA_PROVIDER=lpf-web`, instantiate `LpfWebProvider`
- read optional `LPF_WEB_TOURNAMENT_URL`
- do not require new env globally

### 2.4 Update sync service slug resolution

Modify `sports-data-sync.service.ts`:

- resolve provider tournament key by slug for `lpf-web`

### 2.5 Add provider/sync tests

Create/modify:

- `lpf-web.provider.spec.ts`
- `sports-data-sync.service.spec.ts`

Cover:

- provider key
- team/venue/fixture mapping
- `TC` final result mapping
- `TE+P` skip
- unknown slug
- sync service calls provider with slug

### 2.6 Verify PR2

Run:

```bash
apps/api/node_modules/.bin/tsc --noEmit --project apps/api/tsconfig.json --pretty false
cd apps/api && pnpm exec jest --runInBand src/sports-data/lpf-web.provider.spec.ts src/sports-data/sports-data-sync.service.spec.ts src/sports-data/lpf-web.client.spec.ts src/sports-data/lpf-web.parser.spec.ts
```

## Phase 3 — Documentation

### 3.1 Update Liga PRD

Update `docs/prd/liga-argentina-mode.md`:

- API-Sports limitation discovered
- `lpf-web` chosen for current/free MVP data
- `TC` final marker
- `TE+P` skipped until knockout/penalty scoring design

## PR split plan

### PR1: LPF parser/client stack

Files:

- `lpf-web.types.ts`
- `lpf-web.config.ts`
- `lpf-web.client.ts`
- `lpf-web.parser.ts`
- client/parser tests
- OpenSpec artifacts

### PR2: LPF provider/wiring

Files:

- `lpf-web.provider.ts`
- provider tests
- constants/module/sync-service changes
- docs PRD update

## Acceptance

- Provider tests pass.
- Existing sports-data provider tests continue to pass.
- `TC` final results are importable/stageable.
- `TE+P` is not imported as a normal final result.
