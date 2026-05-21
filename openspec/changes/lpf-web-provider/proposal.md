# Proposal — LPF Website Provider for Liga Argentina

## Problem

The `api-sports` provider is implemented, but API-Sports free plan does not expose current Liga Argentina seasons. The app needs a free/current Liga Argentina data source for MVP validation.

The official Liga Profesional page for Torneo Apertura 2026 exposes fixture and result data server-side:

- https://www.ligaprofesional.ar/torneo-apertura-2026/

The provider layer should support this source without changing frontend UX, scoring rules, or scheduler infrastructure.

## Goals

- Add a minimal `lpf-web` provider behind the existing `SportsDataProvider` abstraction.
- Fetch and parse the official LPF tournament page.
- Import teams, venues, and fixtures through the existing import flow.
- Stage final results only when the LPF match status is `TC`.
- Detect unsupported knockout/penalty status such as `TE+P` and skip it from normal final-result import.
- Preserve `api-sports`, `football-data`, and `mock` providers.
- Keep tests offline via mocked fetch and representative LPF samples.

## Non-goals

- No frontend branding/copy/theme work.
- No automatic scheduled sync.
- No knockout advancement or penalty scoring model.
- No schema migrations unless proven unavoidable.
- No paid API dependency.
- No live-network dependency in automated tests.

## Affected modules

- `apps/api/src/sports-data/*`
- `docs/prd/liga-argentina-mode.md`
- OpenSpec change artifacts under `openspec/changes/lpf-web-provider/`

## Rollback plan

- Keep existing providers untouched and selected only by `SPORTS_DATA_PROVIDER`.
- If LPF parsing fails in production, switch `SPORTS_DATA_PROVIDER` back to `mock`, `football-data`, or `api-sports` without database migration rollback.
- Because final results go through staging/admin review, bad final-result extraction can be discarded before scoring.

## Risks and mitigations

| Risk                                                   | Mitigation                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| LPF HTML changes                                       | Parser tests use representative samples; provider fails loudly when fixture content cannot be parsed. |
| Knockout statuses are ambiguous                        | `TE+P` is skipped in this slice and handled by a future scoring/knockout model.                       |
| No official match IDs in page text                     | Use deterministic IDs derived from tournament/date/teams.                                             |
| Venue/team names may differ from desired display names | Import raw names first; add alias normalization later if needed.                                      |
| Scraping may be rate-sensitive                         | No scheduler in this slice; manual/admin-triggered sync only.                                         |

## Success criteria

- `SPORTS_DATA_PROVIDER=lpf-web` selects the LPF provider.
- `liga-argentina-2026` can be imported from the official page using existing `importTournament()` flow.
- `TC` matches with numeric scores are returned by `listFinalResults()`.
- `TE+P` matches are not imported as normal final results.
- Focused API TypeScript and Jest verification pass.
