# Design — LPF Website Provider

## Architecture

Add `lpf-web` as a new backend sports-data provider parallel to `api-sports` and `football-data`.

```text
SportsDataModule
  └─ SPORTS_DATA_PROVIDER=lpf-web
      └─ LpfWebProvider
          ├─ LpfWebClient.fetchPage(config.url)
          ├─ parseLpfFixturePage(html)
          └─ map parsed rows → SportsData*DTO

SportsDataSyncService
  ├─ importTournament(tournamentId)
  │   └─ provider.listTeams/listVenues/listFixtures(slug)
  └─ syncResults(tournamentId)
      └─ provider.listFinalResults(slug) → staged external results
```

## Key decisions

### Use existing provider contract unchanged

No schema or service-contract change is required. Scraped LPF rows can be mapped to existing DTOs.

### Use deterministic external IDs

The official page text does not expose stable match IDs in the fetched readable output. The provider will derive IDs from tournament slug, date, home team, and away team.

Example:

```text
lpf-web:liga-argentina-2026:2026-05-16:river:central
```

### Conservative final-result policy

Only `TC` is treated as a normal final result. `TE+P` and any other status are skipped for `listFinalResults()`.

### Offline parser tests

Automated tests must use representative LPF text/HTML samples. Live network calls are not part of Jest.

## Files

| File                          | Change                                           |
| ----------------------------- | ------------------------------------------------ |
| `sports-data.constants.ts`    | Add `LPF_WEB: "lpf-web"`.                        |
| `sports-data.module.ts`       | Instantiate `LpfWebProvider` when selected.      |
| `sports-data-sync.service.ts` | Resolve slug for `lpf-web` provider.             |
| `lpf-web.types.ts`            | Provider config and parsed row types.            |
| `lpf-web.config.ts`           | Default `liga-argentina-2026` URL.               |
| `lpf-web.client.ts`           | Fetch official LPF page.                         |
| `lpf-web.parser.ts`           | Parse page HTML/text to normalized fixture rows. |
| `lpf-web.provider.ts`         | Map parser rows to provider DTOs.                |
| `*.spec.ts`                   | Client/parser/provider/sync tests.               |

## Parser design

### Parsed row shape

```ts
interface LpfWebMatchRow {
  status: string;
  dateLabel: string;
  kickoffAt: Date;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  venueName: string | null;
  note: string | null;
}
```

### Parser steps

1. Convert HTML to plain text.
2. Keep only content between `FIXTURE` and the next major section (`PROMEDIOS`, `TABLA DE POSICIONES`, etc.).
3. Normalize repeated whitespace and blank lines.
4. Track the current date heading.
5. Parse rows beginning with known status tokens (`TC`, `TE+P`, plus non-final tokens if observed later).
6. Read the next non-empty line as venue when it does not look like another status/date/section heading.
7. Return rows and parser diagnostics.

## Testing strategy

- `lpf-web.client.spec.ts`
  - default URL fetch
  - override URL
  - non-OK response error
- `lpf-web.parser.spec.ts`
  - parses representative `TC` row
  - parses/marks `TE+P` row without final-result eligibility
  - stops before standings/promedios sections
  - handles venue line
- `lpf-web.provider.spec.ts`
  - maps teams/venues/fixtures
  - returns only `TC` final results
  - skips `TE+P` final results
  - rejects unknown tournament slug
- `sports-data-sync.service.spec.ts`
  - slug resolution for `lpf-web`
  - `liga-argentina-2026` provider sync still allowed

## Verification

Use direct commands only; no build commands.

```bash
apps/api/node_modules/.bin/tsc --noEmit --project apps/api/tsconfig.json --pretty false
cd apps/api && pnpm exec jest --runInBand src/sports-data/lpf-web.parser.spec.ts src/sports-data/lpf-web.provider.spec.ts src/sports-data/sports-data-sync.service.spec.ts
```

## Risks

- Scraping can break when LPF changes markup or text order.
- Penalty/advancement semantics require a separate scoring design.
- Deterministic IDs may change if LPF renames teams; aliases can be introduced later.
