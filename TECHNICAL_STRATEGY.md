# WorldPredict — Technical Strategy

## Strategy Summary

WorldPredict should be built backend/domain-first, but validated through vertical product slices.

This means the scoring, prediction, ranking, and group logic must be designed before visual polish, while still keeping the implementation tied to real user flows.

Recommended first slice:

```txt
Register → list matches → submit prediction → finalize match → score predictions → update ranking
```

## Development Principles

### Backend-first, not backend-only

The domain model and backend rules come first because they protect the product from becoming a fragile UI demo.

However, each backend slice should eventually connect to a real frontend flow.

### TDD for domain logic

The scoring engine, prediction locking, and ranking recalculation must be covered with tests before or alongside implementation.

### Read-heavy design

Most users will read fixtures and rankings far more often than they write predictions.

The system should optimize:

- match list reads
- ranking reads
- group ranking reads
- share card reads

### Idempotent jobs

Scoring and ranking updates must tolerate retries.

If a match finalization job runs twice, it must not duplicate user points.

### Provider abstraction

Sports data provider integration should be abstracted so the product is not locked to one API.

For MVP, manual/admin fixture management or a simple adapter is acceptable.

### Staging-first sports data sync

External provider sync must import fixtures and stage final results separately.

If the provider has not published a result yet, that is a normal sync outcome and must not fail the job.

Official match finalization still belongs to `MatchesService.finalizeMatch()` so scoring and rankings remain under explicit domain control.

## Recommended Architecture

### Applications

```txt
/apps
  /web
```

### Packages

```txt
/packages
  /domain
  /types
  /ui
  /config
```

### Backend

```txt
/backend
  /api
  /jobs
  /ranking-engine
  /sports-data
```

This structure may be adjusted depending on the final stack, but the boundaries should remain explicit.

## NestJS Module Boundaries

WorldPredict will organize the backend around domain-oriented NestJS modules, not generic technical folders.

### Core Modules

#### AuthModule

Responsibilities:

- Validate Auth0 JWT access tokens.
- Extract external identity from requests.
- Protect API endpoints.
- Resolve the current authenticated user.

AuthModule does not store passwords and does not issue proprietary JWTs for MVP/v1.

#### UsersModule

Responsibilities:

- Store and manage internal application profiles.
- Sync Auth0 identity into PostgreSQL users.
- Handle username, country, favorite team, avatar, and preferred language.
- Support onboarding/profile completion.

Primary entity:

- User

#### TournamentsModule

Responsibilities:

- Manage active tournament data.
- Store tournament configuration.
- Manage teams/countries.
- Own scoring rule configuration per tournament.

Primary entities:

- Tournament
- Team
- ScoringRule

#### MatchesModule

Responsibilities:

- Manage fixture data.
- Expose match list and match details.
- Manage match lifecycle/status.
- Finalize matches with official result.

Primary entity:

- Match

#### PredictionsModule

Responsibilities:

- Submit predictions.
- Edit predictions before kickoff.
- Enforce one prediction per user per match.
- Block prediction writes after kickoff.

Primary entity:

- Prediction

#### ScoringModule

Responsibilities:

- Calculate awarded points.
- Apply exact-score and correct-result rules.
- Ensure scoring idempotency.
- Score predictions after match finalization.

This module must be heavily tested because it protects the product's competitive integrity.

#### RankingsModule

Responsibilities:

- Maintain read-optimized ranking entries.
- Serve global ranking.
- Serve group ranking.
- Recalculate rankings after scoring.

Primary entity:

- RankingEntry

#### GroupsModule

Responsibilities:

- Create private groups.
- Generate invite codes or links.
- Join groups.
- Manage memberships and owner/member roles.
- Support group rankings.

Primary entities:

- Group
- GroupMembership

#### ShareCardsModule

Responsibilities:

- Generate share card payloads.
- Render or delegate card rendering.
- Store share card metadata/cache.
- Support prediction, group ranking, and performance cards.

Primary entity:

- ShareCard

#### JobsModule

Responsibilities:

- Coordinate scheduled and retryable backend jobs.
- Update match statuses.
- Trigger scoring jobs.
- Trigger ranking recalculation jobs.
- Provide operational logging around background processes.

JobsModule orchestrates work but must not contain scoring or ranking business logic directly.

### Infrastructure Modules

#### PrismaModule

Responsibilities:

- Provide PrismaService.
- Manage PostgreSQL connection access.

#### ConfigModule

Responsibilities:

- Validate and expose environment variables.
- Configure Auth0 domain/audience.
- Configure database connection.
- Configure frontend/API URLs.

#### HealthModule

Responsibilities:

- Health checks.
- Readiness/liveness endpoints for deployment.

### MVP Module Priority

Initial backend implementation should prioritize:

```txt
AuthModule
UsersModule
TournamentsModule
MatchesModule
PredictionsModule
ScoringModule
RankingsModule
GroupsModule
PrismaModule
ConfigModule
```

Second implementation wave:

```txt
ShareCardsModule
JobsModule
HealthModule
```

JobsModule may be introduced earlier if scoring/ranking automation requires it during the first vertical slice.

## Backend Decision

WorldPredict will use **NestJS + PostgreSQL** as the backend foundation.

This decision prioritizes a solid reusable platform over the fastest possible MVP path.

Reasoning:

- The core product depends heavily on relational concepts: users, tournaments, matches, predictions, groups, memberships, scoring, and rankings.
- Ranking queries, uniqueness constraints, transactional updates, and reporting are more natural with PostgreSQL.
- The long-term vision is not a one-off World Cup app, but a reusable tournament competition engine.
- Strong backend boundaries reduce the risk of building a fragile UI-first prototype.

Firebase may still be considered later for specific supporting capabilities, but it is not the primary backend foundation.

## Persistence Decision

WorldPredict will use **Prisma** as the primary ORM/query layer for PostgreSQL.

Reasoning:

- Prisma has a strong and well-known integration path with NestJS.
- The generated client improves developer experience and type safety.
- The schema file provides a readable source of truth for the relational model.
- Migration workflows are mature enough for MVP and v1 development.
- It supports fast implementation of common CRUD use cases while preserving PostgreSQL as the durable foundation.

For complex ranking recalculations, aggregates, or performance-sensitive jobs, controlled raw SQL may be used behind explicit repository/service boundaries.

## Authentication Decision

WorldPredict will use **Auth0** as the identity provider.

### Auth0 Responsibilities

- Google login.
- Optional email/password login.
- Password recovery.
- Email verification if enabled.
- OAuth/session handling.
- Access token issuance.

### NestJS Responsibilities

- Validate Auth0-issued JWT access tokens.
- Treat the API as a resource server.
- Map Auth0 identities to internal PostgreSQL users.
- Enforce application-level authorization and roles.
- Store WorldPredict-specific profile data.

### Token Strategy

NestJS will **not** issue its own JWT for MVP/v1.

The frontend authenticates with Auth0 and sends the Auth0 access token to the NestJS API:

```txt
User logs in with Google/Auth0
→ Auth0 issues access token
→ Frontend calls NestJS API with Bearer token
→ NestJS validates issuer/audience/signature
→ NestJS loads or creates internal user profile
→ Application use case runs
```

Reasoning:

- Avoids duplicating authentication responsibilities.
- Reduces security-sensitive custom code.
- Keeps Google login and password recovery delegated to a specialized provider.
- Still allows WorldPredict to own domain-specific user profile and authorization data.

### Internal User Mapping

The PostgreSQL `users` table should store application user data, not passwords.

Recommended fields:

- id
- authProvider
- authSubject
- email
- username
- country
- favoriteTeam
- avatar
- preferredLanguage
- createdAt
- updatedAt

The pair `(authProvider, authSubject)` must be unique.

## Backend Options Considered

### Option A — Firebase-first

#### Stack

- Firebase Auth
- Firestore
- Cloud Functions
- Scheduled Functions
- Firebase Hosting or Vercel for web

#### Pros

- Fastest MVP path.
- Built-in auth.
- Good for rapid iteration.
- Easy real-time reads if needed.

#### Cons

- Ranking aggregation must be designed carefully.
- Query limitations can hurt complex reporting.
- Costs and write amplification need monitoring during traffic spikes.

#### Best For

Fast validation before committing to heavier infrastructure.

### Option B — NestJS + PostgreSQL

#### Stack

- NestJS
- PostgreSQL
- Prisma
- Redis optional for rankings/cache
- Auth0 for identity and JWT access tokens

#### Pros

- Strong relational modeling.
- Better for rankings, constraints, and reporting.
- Clear backend architecture.
- Easier complex queries.

#### Cons

- Slower initial setup.
- More infrastructure decisions.
- Auth and deployment require more work.

#### Best For

A more durable foundation if the product is expected to scale beyond one tournament.

### Final Decision

Use **NestJS + PostgreSQL**.

This favors platform quality, explicit domain modeling, relational integrity, and long-term maintainability over the fastest initial setup.

## Frontend Strategy

### Stack

- Next.js
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- Zustand for local UI/session-adjacent state
- React Query for server state
- Framer Motion for microinteractions

### UI Direction

- Mobile-first.
- Dark mode first.
- Competitive sports/esports feeling.
- No casino/betting visual language.
- Fast, rewarding feedback.

### Landing Page

Use a short landing page before authentication.

Purpose:

- Explain the product quickly.
- Convert users arriving from share cards.
- Create emotional motivation before login.

Avoid:

- Large SaaS-style marketing page.
- Too many sections.
- Corporate tone.

## Data Strategy

### Collections or Tables

Minimum concepts:

- users
- tournaments
- teams
- matches
- predictions
- groups
- group_memberships
- ranking_entries
- share_cards

### Ranking Storage

Rankings should be precomputed instead of calculated from scratch on every request.

Required ranking scopes for MVP:

- global
- group

Optional:

- country

### Ranking Tie-breakers

Rankings will be ordered by:

```txt
1. totalPoints DESC
2. exactPredictions DESC
3. predictionsCount DESC
4. lastScoredAt ASC
5. userId ASC
```

Reasoning:

- Points remain the primary competitive metric.
- Exact predictions reward precision.
- Prediction count rewards participation.
- Earlier scoring time provides a stable fairness tie-breaker.
- User ID provides deterministic technical ordering if all else ties.

### Ranking Position Model

WorldPredict will use **dense ranking** for MVP.

Example:

```txt
1, 2, 2, 3
```

Dense ranking is easier for users to understand and avoids large perceived gaps in small groups.

### Prediction Constraints

Enforce uniqueness:

```txt
unique(userId, matchId)
```

If using Firestore, enforce via deterministic document IDs or transactional writes.

With PostgreSQL and Prisma, enforce this with a database-level unique constraint.

### Scoring Constraints

Store scoring state on predictions:

- pending
- scored
- void

This prevents duplicate scoring and makes retries safer.

## API / Use Case Layer

The backend should expose use cases, not random database operations.

### Initial Use Cases

- register/login user
- sync authenticated Auth0 user into internal profile
- complete profile
- get active tournament
- list matches
- submit prediction
- update prediction before kickoff
- finalize match
- score finalized match
- get global ranking
- create group
- join group
- get group ranking
- generate share card

## Jobs and Automation

### MVP Jobs

- Match status updater.
- Match finalization processor.
- Prediction scoring job.
- Ranking recalculation job.

### Job Runner Decision

WorldPredict will use **BullMQ + Redis** for critical backend jobs.

Reasoning:

- Scoring and ranking jobs are part of the competitive core.
- Critical jobs need retries and operational visibility.
- Queue-backed jobs are safer than simple in-process cron for production growth.
- Redis adds infrastructure, but the reliability tradeoff is acceptable.

NestJS Schedule may still be used for lightweight non-critical triggers, but scoring/ranking should run through BullMQ.

### Job Requirements

- Retry-safe.
- Observable logs.
- No duplicate points.
- Manual re-run support.

### MVP Match Finalization Strategy

MVP will support **manual/admin match finalization first**.

External sports provider automation comes later behind an adapter.

Initial flow:

```txt
Admin finalizes match with official score
→ Match becomes FINISHED
→ ScoreFinalizedMatchJob scores pending predictions
→ RecalculateRankingsJob updates ranking entries
```

Reasoning:

- Avoids making MVP reliability dependent on a sports data provider.
- Allows manual correction if external data is delayed or wrong.
- Keeps the core product loop testable before provider integration.

### Critical Jobs

```txt
MatchStatusUpdateJob
ScoreFinalizedMatchJob
RecalculateRankingsJob
```

### Scoring Idempotency

Scoring jobs must only process predictions with:

```txt
scoringStatus = PENDING
```

Already scored predictions must not be modified by retrying the same job.

### Ranking Recalculation Strategy

Rankings should be recalculated from official scored prediction data and written via aggregate/upsert.

Avoid fragile incremental ranking updates when possible.

### Scoreable Match Rule

A match can be scored only when:

```txt
status = FINISHED
homeScore IS NOT NULL
awayScore IS NOT NULL
finalizedAt IS NOT NULL
```

## Admin Strategy

### MVP Admin

MVP will use protected admin endpoints before building an admin dashboard.

Initial admin capabilities:

- create/update tournament data
- create/update teams
- create/update matches
- finalize matches
- manually trigger scoring/ranking jobs if needed

Admin dashboard is deferred until operational needs justify frontend investment.

## Testing Strategy

### Highest Priority Tests

- Exact score scoring.
- Correct winner/draw scoring.
- Wrong prediction scoring.
- Prediction cannot be edited after kickoff.
- One prediction per user per match.
- Scoring job is idempotent.
- Ranking updates after scoring.
- Group ranking includes only group members.

### Test Style

Domain logic should be tested without requiring real external services.

External provider sync should be tested behind adapters/mocks.

## Visual Asset Strategy

Do not generate final visual assets immediately.

Generate them after:

1. MVP scope is locked.
2. Domain model is accepted.
3. Technical strategy is accepted.
4. First UX flows are defined.

### First Assets to Generate

- Logo direction.
- App icon.
- Landing hero visual.
- Prediction card preview.
- Ranking card preview.
- Share card templates.

### Asset Rules

- Avoid official FIFA marks.
- Avoid copyrighted tournament graphics.
- Use country flags carefully and consistently.
- Prefer original tournament branding.
- Avoid betting/casino styling.

## Delivery Phases

### Phase 1 — Domain + Backend Foundation

- Define domain model.
- Implement scoring engine.
- Implement predictions.
- Implement match finalization.
- Implement ranking calculation.

### Phase 2 — Groups + Share Mechanics

- Create group.
- Join group.
- Group ranking.
- Generate basic share cards.

### Phase 3 — Frontend MVP

- Landing.
- Auth flow.
- Onboarding.
- Fixture.
- Prediction UI.
- Ranking UI.
- Group UI.

### Phase 4 — PWA + Polish

- Manifest.
- Installable PWA behavior.
- Basic caching.
- Microinteractions.
- Final mobile polish.

## Key Technical Risks

### Ranking Recalculation

Risk: rankings become slow or inconsistent during match spikes.

Mitigation: precompute ranking entries and make recalculation idempotent.

### Match Data Reliability

Risk: external sports data provider fails or returns delayed data.

Mitigation: provider abstraction, manual override, retry jobs.

### Scope Creep

Risk: adding achievements, push notifications, trivia, and advanced stats too early.

Mitigation: protect the MVP loop and defer everything else.

### Betting Perception

Risk: users or platforms interpret the product as gambling.

Mitigation: avoid betting language, odds, casino visuals, and monetary mechanics.

## Immediate Next Step

Define the backend architecture in detail:

- NestJS module boundaries.
- PostgreSQL schema strategy.
- Jobs strategy.
- Testing strategy for domain logic and persistence.
