# Design: Tournament Selector Multi-Tournament Context

## Technical Approach
Phase 1 adds a transport-agnostic tournament context resolver. The web app stores the selected tournament slug in a cookie, the shared app shell reads it server-side, and API controllers pass that selection into `TournamentsService`. Resolution order is: explicit `tournamentId` (admin writes) → cookie slug (web/admin reads) → single `ACTIVE` tournament fallback. Existing ACTIVE-only behavior remains as an internal fallback path so current flows do not break while user-facing reads become selector-aware.

## Architecture Decisions

### Decision: Resolve selection by slug
| Option | Tradeoff | Decision |
|---|---|---|
| Cookie stores DB id | Fast lookup, brittle for future routing | Rejected |
| Cookie stores slug | Stable, route-compatible, one extra lookup | Chosen |

**Rationale**: `slug` already exists in the model and is the future route key, so phase 1 can reuse it now without redesigning later.

### Decision: Keep context resolution at transport edges
| Option | Tradeoff | Decision |
|---|---|---|
| Request-scoped DI service | Implicit wiring, more Nest complexity | Rejected |
| Controller/helper passes context to services | Explicit, testable, no scope churn | Chosen |

**Rationale**: current services are singleton Prisma-based services. Passing a small context object avoids broad DI changes and keeps existing tests readable.

### Decision: Preserve one deterministic ACTIVE fallback
| Option | Tradeoff | Decision |
|---|---|---|
| Multiple ACTIVE tournaments | Easy seeding, ambiguous fallback | Rejected |
| One ACTIVE provider-backed tournament + selectable demo | Clear fallback, selector handles demo | Chosen |

**Rationale**: fallback MUST be deterministic. Demo data stays available, but only one tournament should satisfy ACTIVE queries.

## Data Flow
```text
Browser
  -> shared app shell reads `wc_tournament` cookie
  -> web `fetchJson()` forwards cookie header to API
  -> controller extracts selected slug / explicit tournamentId
  -> TournamentsService.resolveTournamentContext()
       explicit id -> cookie slug -> ACTIVE tournament
  -> downstream service queries by resolved tournament.id
```

```text
Admin read flow: selected cookie -> diagnostics/results/sync-runs filtered to current tournament
Admin write flow: selected tournament -> explicit body.tournamentId -> provider capability check -> import/sync
```

This keeps reads selector-aware, while mutation endpoints stay explicit for operational safety.

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/tournament-selector-multi-tournament-context/design.md` | Create | Phase design artifact. |
| `apps/api/src/tournaments/tournaments.service.ts` | Modify | Add `listTournaments`, `resolveTournamentContext`, and strict ACTIVE fallback helper. |
| `apps/api/src/tournaments/tournaments.controller.ts` | Modify | Accept cookie-aware current-tournament reads and add tournament list endpoint. |
| `apps/api/src/groups/groups.service.ts` | Modify | Create groups against resolved current tournament instead of implicit ACTIVE. |
| `apps/api/src/rankings/rankings.service.ts` | Modify | Load global ranking for resolved tournament context. |
| `apps/api/src/share-cards/share-cards.service.ts` | Modify | Use resolved tournament context only for global summary cards. |
| `apps/api/src/users/users.service.ts` | Modify | Validate favorite team within resolved tournament context. |
| `apps/api/src/sports-data/sports-data.controller.ts` | Modify | Read selected tournament for GET flows; require explicit `tournamentId` on sync/import POSTs. |
| `apps/api/src/sports-data/sports-data-sync.service.ts` | Modify | Reuse central resolution helper and reject provider actions for unsupported tournaments. |
| `apps/api/prisma/seed.ts` | Modify | Split demo seed payload from provider-backed tournament seed and enforce one ACTIVE fallback. |
| `apps/web/src/lib/api.ts` | Modify | Add tournament list/current helpers and cookie-forwarding fetch options. |
| `apps/web/src/app/layout.tsx` | Create | Introduce shared shell/navigation entry point for selector placement. |
| `apps/web/src/components/tournaments/tournament-selector.tsx` | Create | Server/client selector UI that writes cookie and refreshes. |
| `apps/web/src/lib/tournament-context.ts` | Create | Cookie constants and parsing helpers shared by web shell/actions. |

## Interfaces / Contracts

```ts
interface TournamentContextInput {
  explicitTournamentId?: string;
  selectedSlug?: string | null;
}

interface ResolvedTournamentContext {
  tournament: TournamentView;
  source: 'explicit' | 'cookie' | 'active';
}
```

`GET /tournaments` returns selector options. Existing `/tournaments/active` and `/tournaments/active/matches` keep their routes, but resolve “current tournament” via context before falling back to strict ACTIVE.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Resolver precedence, invalid cookie fallback, unsupported admin sync | Extend Jest tests for tournaments and sports-data services. |
| Integration | Groups/rankings/users/share-cards use selected tournament without regressions | Service tests with multiple tournaments in Prisma mocks. |
| E2E | Selector persists choice and switches visible matches/admin reads | Manual verification in phase 1; automate later when web test harness exists. |

## Migration / Rollout
No schema migration required. Seed/reseed must create both tournaments, keep only one ACTIVE fallback, and preserve demo fixtures under the demo slug. Existing environments with multiple ACTIVE tournaments need a one-time data correction before rollout.

## Open Questions
- [ ] None blocking for phase 1.
