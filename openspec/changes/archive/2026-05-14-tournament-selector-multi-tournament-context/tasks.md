# Tasks: Tournament Selector Multi-Tournament Context

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300-500 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend context resolver and service updates | PR 1 | Base branch; tests included |
| 2 | Frontend selector UI and cookie handling | PR 2 | Depends on PR 1 |
| 3 | Seed/data separation and migration scripts | PR 3 | Independent |

## Phase 1: Foundation and Core Implementation

### Selector UI in Shared Shell
- [ ] Create shared shell layout component (`apps/web/src/app/layout.tsx`)
- [ ] Create tournament selector component (`apps/web/src/components/tournaments/tournament-selector.tsx`)
- [ ] Implement selector UI with dropdown showing available tournaments
- [ ] Add state management for selector open/closed state
- [ ] Implement selection handler that writes cookie and triggers page refresh
- [ ] Add loading states for tournament list fetching
- [ ] Style selector to match existing UI patterns
- [ ] Ensure selector is accessible (ARIA labels, keyboard navigation)

### Cookie Persistence and Context Resolver
- [ ] Create tournament context constants file (`apps/web/src/lib/tournament-context.ts`)
- [ ] Define cookie name (`wc_tournament`) and parsing helpers
- [ ] Implement cookie read/write utilities with proper expiration/security
- [ ] Create server-side cookie reader for Next.js App Router
- [ ] Build transport-agnostic tournament context resolver service
- [ ] Implement resolution order: explicit → cookie → ACTIVE fallback
- [ ] Add validation for cookie values against known tournaments
- [ ] Create TypeScript interfaces for context input/output

### API/Web Fallback Behavior
- [ ] Modify TournamentsService to add `resolveTournamentContext()` method
- [ ] Add `listTournaments()` method for selector UI data
- [ ] Implement strict ACTIVE fallback helper for internal compatibility
- [ ] Update TournamentsController to accept cookie header and explicit tournamentId
- [ ] Modify GroupsService to use resolved tournament context
- [ ] Update RankingsService to load global ranking for resolved context
- [ ] Adjust ShareCardsService to use resolved tournament context
- [ ] Modify UsersService to validate favorite team within resolved context
- [ ] Update SportsDataController to read selected tournament for GET flows
- [ ] Require explicit tournamentId on sync/import POSTs in SportsDataController
- [ ] Update SportsDataSyncService to reuse resolution helper
- [ ] Add provider action rejection for unsupported tournaments

### Seed/Data Separation
- [x] Modify Prisma seed script to separate demo and provider-backed tournaments
- [x] Create demo tournament payload with fixed slug
- [x] Create provider-backed tournament payload with actual provider data
- [x] Enforce exactly one ACTIVE tournament (provider-backed) in seed
- [x] Preserve demo fixtures under demo tournament slug
- [x] Add validation to prevent multiple ACTIVE tournaments in seed
- [x] Accept pnpm prisma:seed as the supported reseed workflow (maintains separation)
- [x] Seed data expectations documented in apps/api/prisma/seed.ts

### Regression Coverage
- [ ] Write unit tests for tournament context resolver precedence
- [ ] Test invalid cookie fallback to ACTIVE tournament
- [ ] Test unsupported admin sync rejection
- [ ] Extend GroupsService tests with multiple tournaments in Prisma mocks
- [ ] Extend RankingsService tests with tournament context
- [ ] Extend ShareCardsService tests with tournament context
- [ ] Extend UsersService tests with favorite team validation
- [ ] Extend SportsDataSyncService tests with provider action restrictions
- [ ] Manual verification checklist for selector persistence and admin reads
- [ ] Create test plan for E2E verification when web test harness available