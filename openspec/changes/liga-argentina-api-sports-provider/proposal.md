# Proposal: Liga Argentina api-sports provider

## Problem

Liga Argentina mode requires a sports-data source that can provide Liga Profesional Argentina fixtures and results. The current backend sports-data integration supports the existing provider abstraction, but only ships with `football-data` and mock implementations. Without an `api-sports` provider, the approved Liga Argentina mode cannot ingest provider data for tournament sync flows.

## Goals

- Add an `api-sports.io` backend provider that plugs into the existing `SportsDataProvider` abstraction.
- Support Liga Argentina tournament configuration for `liga-argentina-2026` using api-sports league metadata.
- Allow deployments to select `SPORTS_DATA_PROVIDER=api-sports` through configuration.
- Map api-sports fixtures, teams, venues, and final results into the shared sports-data DTOs.
- Preserve the existing idempotent `SportsDataSyncService.syncResults()` staging flow.
- Avoid regressions for current `football-data` and mock provider behavior.

## Non-goals

- No frontend branding, metadata, or copy updates for Liga Argentina mode.
- No repository fork or parallel product split.
- No automatic sync scheduler, BullMQ workflow, or background job design.
- No Prisma schema changes or database migrations.
- No Liga-specific scoring rule changes.
- No multi-provider runtime within a single deployment beyond selecting one configured provider.

## Scope

This change adds a new backend provider implementation for api-sports and wires it into existing provider selection and sync logic. The slice is limited to data ingestion and mapping needed for Liga Argentina sync flows.

## Affected modules

- `apps/api/src/sports-data/sports-data.constants.ts`
- `apps/api/src/sports-data/sports-data.module.ts`
- `apps/api/src/sports-data/sports-data-sync.service.ts`
- `apps/api/src/sports-data/api-sports.client.ts`
- `apps/api/src/sports-data/api-sports.provider.ts`
- `apps/api/src/sports-data/api-sports.types.ts`
- `apps/api/src/sports-data/api-sports.config.ts`
- `apps/api/src/sports-data/*.spec.ts` for provider/client coverage
- Environment/config documentation or templates for `API_SPORTS_API_KEY` and optional base URL configuration

## Proposed approach

- Extend the sports-data provider key set with `api-sports`.
- Implement an api-sports HTTP client for `v3.football.api-sports.io` using the provider API key header.
- Implement `ApiSportsProvider` to translate api-sports payloads into shared DTOs.
- Add Liga Argentina provider config with `leagueId: 128` and season metadata for `liga-argentina-2026`.
- Update module factory wiring so backend deployments can instantiate the new provider via environment configuration.
- Extend provider-backed tournament gating so Liga Argentina sync is allowed alongside existing supported tournaments.
- Add tests for client request construction, DTO mapping, and final-result filtering on `fixture.status.short === "FT"`.

## Risks and open questions

- api-sports response fields may vary by endpoint or season, especially fixture, team, venue, and score nesting.
- Team abbreviations may be incomplete; short-name or code fallback rules may need explicit mapping behavior.
- api-sports rate limits may constrain sync frequency; this proposal does not add caching or scheduling controls.
- Liga Argentina season/year alignment for `liga-argentina-2026` must match the target api-sports season value.
- Environment validation should remain compatible with existing deployments that do not use api-sports.

## Rollback plan

- Revert provider registration and remove `api-sports` from the provider key set.
- Restore `SPORTS_DATA_PROVIDER` usage to existing `football-data` or mock values.
- Remove Liga Argentina provider tournament support from sync gating if integration proves unstable.
- Because this slice avoids schema changes, rollback is code/config only.

## Success criteria

- Backend can boot with `SPORTS_DATA_PROVIDER=api-sports` and a configured `API_SPORTS_API_KEY`.
- `ApiSportsProvider` implements the shared provider contract for teams, venues, fixtures, and final results.
- Final results only include fixtures with `fixture.status.short === "FT"`.
- `liga-argentina-2026` is accepted by provider-backed sync flows.
- Existing `football-data` and mock provider behavior remains unchanged.
- Unit coverage exists for client wiring and provider mapping logic.

## Implementation notes

- This slice intentionally excludes frontend branding and automatic synchronization.
- No build or deployment workflow changes are proposed in this artifact.
