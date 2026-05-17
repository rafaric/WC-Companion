# Liga Argentina Mode — Product Draft

WorldPredict should support Liga Argentina as a configurable product mode inside the existing application, not as a fork. This keeps scoring, auth, admin flows, i18n, deployment hardening, and sports-data infrastructure reusable while leaving room for a dedicated Liga Argentina deployment later.

## Decision

| Topic | Decision |
|-------|----------|
| Repository strategy | Do **not** fork WC-Competition for now. |
| Product shape | Implement Liga Argentina as a WorldPredict mode. |
| Runtime model | Use environment/configuration to select provider, tournament, and branding. |
| Immediate status | Future feature only. No implementation starts from this document. |

## Why not fork now

A fork would create short-term speed but long-term duplication:

- duplicated bug fixes across auth, scoring, admin, i18n, and deploy;
- duplicated schema and migrations;
- duplicated sports-data provider work;
- two products drifting before the Liga-specific needs are proven.

The current codebase already has the right direction: provider abstraction, tournament context, admin external-results review, scoring, rankings, and localized surfaces.

## Proposed product mode

A future Liga Argentina deployment can reuse the same codebase with different configuration.

```env
APP_BRAND=liga-argentina
SPORTS_DATA_PROVIDER=api-sports
DEFAULT_TOURNAMENT_SLUG=liga-argentina-2026
API_SPORTS_API_KEY=<api_key>
```

This should allow either:

- one app deployment focused on World Cup;
- another deployment focused on Liga Argentina;
- or, later, one multi-tournament product if the UX supports it.

## Future slices

### Slice 1 — api-sports provider

Goal: support Liga Argentina data ingestion through `api-sports.io` without changing frontend behavior.

Likely scope:

- add API client for `v3.football.api-sports.io`;
- add `ApiSportsProvider` implementing the existing `SportsDataProvider` interface;
- add Liga Argentina provider config, including `leagueId: 128`;
- support `SPORTS_DATA_PROVIDER=api-sports`;
- add `API_SPORTS_API_KEY` to env validation/templates;
- verify football-data and mock provider behavior do not regress.

### Slice 2 — Liga Argentina branding mode

Goal: let the same app present Liga Argentina-specific copy and metadata without duplicating routes.

Likely scope:

- brand config such as app name, competition label, metadata, and hero copy;
- optional color/theme tokens if needed;
- no scoring rule changes unless product requirements demand them.

### Slice 3 — automatic result sync

Goal: sync final results without manual admin intervention.

This needs a separate technical decision. The previous draft assumed BullMQ already existed, but the current backend only has a comment noting BullMQ as a future production owner for the finalization path.

Options to evaluate later:

- BullMQ worker with Redis;
- Nest scheduler for a smaller MVP;
- hosted/platform scheduler that calls the existing admin sync endpoint;
- no automation until provider integration is stable.

## Original requirements to preserve

The original draft wanted:

- `api-sports.io` as a second sports-data provider;
- Liga Profesional Argentina support via `leagueId: 128`;
- final-result filtering for `fixture.status.short === "FT"`;
- idempotent result staging through the existing `SportsDataSyncService.syncResults()` flow;
- no regression for `football-data.org`.

These remain useful requirements, but they should be validated during Slice 1 planning.

## Explicit non-goals for now

- No repository fork.
- No frontend implementation yet.
- No automatic sync implementation yet.
- No BullMQ assumption until job infrastructure is designed.
- No simultaneous multi-provider runtime unless a future design requires it.
- No Liga-specific scoring changes yet.

## Next step when resumed

Create a dedicated issue for the first slice:

```text
feat(api): add api-sports provider for Liga Argentina mode
```

Before implementation, confirm api-sports endpoint shapes, request counts, and rate-limit behavior for the exact Liga Argentina season being targeted.
