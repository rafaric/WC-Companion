# SDD Explore — feat(api): add LPF website provider for Liga Argentina

## status

`explore_complete`

## executive_summary

API-Sports provider support is implemented, but the free plan does not expose current Liga Argentina seasons. The official LPF page (`https://www.ligaprofesional.ar/torneo-apertura-2026/`) exposes current fixture and result content server-side, so the next viable free provider is a conservative scraper-based provider behind the existing `SportsDataProvider` abstraction.

The minimal provider should be named `lpf-web` and should reuse the existing import/sync/staging/scoring flow. It should fetch a configured LPF tournament URL, parse fixture rows, import teams/fixtures, and only treat status `TC` as a normal final result. Knockout/penalty statuses such as `TE+P` must be detected but skipped for now because knockout advancement and penalty scoring are separate product/scoring concerns also relevant to World Cup knockout stages.

No frontend branding, scheduler, BullMQ, or scoring-model changes are in scope for the first provider slice.

## relevant_current_architecture

- `apps/api/src/sports-data/sports-data.types.ts` defines the provider contract:
  - `listTeams(tournamentId: string)`
  - `listVenues(tournamentId: string)`
  - `listFixtures(tournamentId: string)`
  - `listFinalResults(tournamentId: string)`
- Existing providers are selected by `SPORTS_DATA_PROVIDER` in `apps/api/src/sports-data/sports-data.module.ts`.
- `football-data`, `api-sports`, and `mock` providers already prove the provider abstraction works.
- `SportsDataSyncService` is provider-agnostic once DTOs are returned.
- `syncResults()` stages final results for admin review instead of applying them blindly.
- `SUPPORTED_PROVIDER_TOURNAMENT_SLUGS` currently gates provider-backed syncs and includes `world-cup-2026` and `liga-argentina-2026`.
- `api-sports` currently resolves provider tournament keys by slug; `lpf-web` should do the same.

## proposed_change_boundary

### In scope

- Add `LPF_WEB: "lpf-web"` provider key.
- Add `LpfWebClient` for fetching LPF tournament pages.
- Add `LpfWebProvider implements SportsDataProvider`.
- Add `LPF_WEB_TOURNAMENT_CONFIGS` with `liga-argentina-2026` pointing to the official LPF Apertura 2026 page.
- Add `LPF_WEB_TOURNAMENT_URL` optional env override for local testing/config flexibility.
- Parse enough LPF page content to produce:
  - teams from fixture rows;
  - venues from fixture rows when available;
  - fixtures from fixture rows;
  - final results only for rows with status `TC`.
- Detect `TE+P` rows but skip them from `listFinalResults()` initially.
- Add tests with captured/minimal HTML fixtures to avoid network-dependent test runs.
- Preserve `api-sports`, `football-data`, and `mock` behavior.

### Out of scope

- No frontend branding mode.
- No automatic scheduled sync.
- No knockout advancement or penalty outcome model.
- No scoring changes for `TE+P` / penalties.
- No paid provider dependency.
- No live-network tests in normal Jest suite.

## scraping_strategy

The initial fetch showed the LPF page text contains sections like:

```text
TORNEO APERTURA MERCADO LIBRE 2026
FIXTURE
Fecha 1
...
sábado 16 mayo 2026

TC River 1 0 Central
Mâs Monumental Página del partido

domingo 17 mayo 2026

TE+P Argentinos Jrs. 1 1 Belgrano
Diego Armando Maradona Página del partido
Belgrano Gana por penales 4-3
```

Recommended parser strategy:

1. Fetch HTML from configured URL.
2. Extract readable text from the fixture area or from the full page as a fallback.
3. Normalize whitespace and accents only where needed for parsing.
4. Segment by date headings (`sábado 16 mayo 2026`, etc.).
5. Parse match rows conservatively:
   - status token first (`TC`, `TE+P`, maybe future statuses);
   - home team name;
   - home score;
   - away score;
   - away team name;
   - venue on following line when available.
6. Produce stable external IDs from deterministic page-derived values, e.g. `lpf-web:<tournamentSlug>:<date>:<home>:<away>` if no official match id is present.
7. `listFinalResults()` returns only `TC` rows with numeric scores.
8. `TE+P` is logged/skipped from final results until knockout/penalty modeling is designed.

Because scraping HTML is fragile, tests should target small fixture samples representing actual LPF text structure rather than the full live page.

## risks/open_questions

| Risk / Question                                       | Mitigation / Note                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| HTML structure can change                             | Keep parser small, fixture-based tests, and fail loudly when expected content is missing.               |
| LPF page may include multiple sections after fixture  | Stop parsing at known section boundary such as `PROMEDIOS` or `TABLA DE POSICIONES`.                    |
| `TE+P` semantics affect scoring                       | Skip for now; create separate scoring/design slice for knockout advancement outcomes.                   |
| No official match IDs visible in server text          | Use deterministic external IDs based on tournament/date/teams; revisit if hidden IDs are found in HTML. |
| Team aliases differ from future branding/team records | Start with provider-created teams from LPF text; later add alias normalization if needed.               |
| Venue names may contain mojibake (`Mâs Monumental`)   | Preserve raw name initially; add normalization only if it impacts UX/reference matching.                |
| Network dependency                                    | Client tests mock fetch; provider parser tests use static HTML/text samples.                            |

## likely_files

| File                                                   | Action                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- |
| `apps/api/src/sports-data/sports-data.constants.ts`    | Add `LPF_WEB` provider key.                                      |
| `apps/api/src/sports-data/sports-data.module.ts`       | Wire `LpfWebProvider` when `SPORTS_DATA_PROVIDER=lpf-web`.       |
| `apps/api/src/sports-data/sports-data-sync.service.ts` | Resolve provider tournament key by slug for `lpf-web` if needed. |
| `apps/api/src/sports-data/lpf-web.types.ts`            | Create raw parsed-page types/config interfaces.                  |
| `apps/api/src/sports-data/lpf-web.config.ts`           | Create tournament config for `liga-argentina-2026`.              |
| `apps/api/src/sports-data/lpf-web.client.ts`           | Create fetch client for LPF page.                                |
| `apps/api/src/sports-data/lpf-web.parser.ts`           | Create parser from LPF page text/html to normalized match rows.  |
| `apps/api/src/sports-data/lpf-web.provider.ts`         | Create provider mapping parsed rows to `SportsData*DTO`.         |
| `apps/api/src/sports-data/lpf-web.client.spec.ts`      | Client tests.                                                    |
| `apps/api/src/sports-data/lpf-web.parser.spec.ts`      | Parser tests with representative LPF sample.                     |
| `apps/api/src/sports-data/lpf-web.provider.spec.ts`    | Provider mapping tests.                                          |
| `docs/prd/liga-argentina-mode.md`                      | Update to document api-sports limitation and lpf-web fallback.   |

## recommended_change_id

`lpf-web-provider`

## next_recommended

Proceed to SDD proposal/spec/design/tasks for `lpf-web-provider`. Keep the first implementation minimal and review-budget aware; the parser/provider slice may exceed 400 lines if tests include broad fixtures, so plan PR splitting if needed.

## skill_resolution

`parent-authored` — subagent explore became blocked waiting for file-write handling, so the parent persisted this explore directly using fetched LPF page evidence and current repo context.
