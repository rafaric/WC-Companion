# WorldPredict — Prisma Schema Draft

## Purpose

This document defines the first PostgreSQL/Prisma data model draft for WorldPredict.

It is not yet the final `schema.prisma`; it is a reviewable design artifact before backend initialization.

## Design Principles

### Relational integrity first

Core product rules must be enforced at the database level when possible.

Examples:

- One prediction per user per match.
- One membership per user per group.
- One Auth0 identity per internal user.

### Domain clarity over generic tables

Tables should reflect product concepts: tournaments, matches, predictions, groups, rankings, and share cards.

### Read-optimized rankings

Ranking data should be precomputed into `RankingEntry` instead of calculated from raw predictions on every request.

### Idempotent scoring

Predictions need explicit scoring state so scoring jobs can safely retry.

## Prisma Enums

```prisma
enum TournamentStatus {
  DRAFT
  ACTIVE
  FINISHED
}

enum MatchStatus {
  UPCOMING
  LIVE
  FINISHED
}

enum PredictionScoringStatus {
  PENDING
  SCORED
  VOID
}

enum RankingScope {
  GLOBAL
  GROUP
  COUNTRY
}

enum GroupRole {
  OWNER
  MEMBER
}

enum ShareCardType {
  PREDICTION
  GROUP_RANKING
  PERFORMANCE_SUMMARY
}
```

## Draft Schema

```prisma
model User {
  id                String            @id @default(uuid())
  authProvider      String
  authSubject       String
  email             String
  username          String            @unique
  country           String?
  favoriteTeamId    String?
  avatar            String?
  preferredLanguage String            @default("es")
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  favoriteTeam      Team?             @relation("FavoriteTeam", fields: [favoriteTeamId], references: [id], onDelete: SetNull)
  predictions       Prediction[]
  ownedGroups       Group[]           @relation("GroupOwner")
  memberships       GroupMembership[]
  rankingEntries    RankingEntry[]
  shareCards        ShareCard[]

  @@unique([authProvider, authSubject])
  @@index([email])
  @@index([country])
  @@index([favoriteTeamId])
}

model Tournament {
  id           String           @id @default(uuid())
  name         String
  slug         String           @unique
  year         Int
  status       TournamentStatus @default(DRAFT)
  startsAt     DateTime?
  endsAt       DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  teams        Team[]
  matches      Match[]
  predictions  Prediction[]
  scoringRules ScoringRule[]
  groups       Group[]
  rankings     RankingEntry[]
  shareCards   ShareCard[]

  @@index([status])
  @@index([year])
}

model Team {
  id             String     @id @default(uuid())
  tournamentId   String
  name           String
  shortName      String
  countryCode    String?
  flagCode       String?
  primaryColor   String?
  secondaryColor String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  tournament     Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  homeMatches    Match[]    @relation("HomeTeam")
  awayMatches    Match[]    @relation("AwayTeam")
  favoriteUsers  User[]     @relation("FavoriteTeam")

  @@unique([tournamentId, name])
  @@index([tournamentId])
  @@index([countryCode])
}

model Match {
  id            String       @id @default(uuid())
  tournamentId  String
  homeTeamId    String
  awayTeamId    String
  stage         String?
  groupName     String?
  kickoffAt     DateTime
  status        MatchStatus  @default(UPCOMING)
  homeScore     Int?
  awayScore     Int?
  finalizedAt   DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  tournament    Tournament   @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  homeTeam      Team         @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeam      Team         @relation("AwayTeam", fields: [awayTeamId], references: [id])
  predictions   Prediction[]
  shareCards    ShareCard[]

  @@index([tournamentId, kickoffAt])
  @@index([status])
  @@index([homeTeamId])
  @@index([awayTeamId])
}

model Prediction {
  id             String                  @id @default(uuid())
  tournamentId   String
  matchId        String
  userId         String
  homeScore      Int
  awayScore      Int
  pointsAwarded  Int                     @default(0)
  scoringStatus  PredictionScoringStatus @default(PENDING)
  submittedAt    DateTime                @default(now())
  updatedAt      DateTime                @updatedAt
  scoredAt       DateTime?

  tournament     Tournament              @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  match          Match                   @relation(fields: [matchId], references: [id], onDelete: Cascade)
  user           User                    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, matchId])
  @@index([tournamentId])
  @@index([matchId])
  @@index([userId])
  @@index([scoringStatus])
}

model ScoringRule {
  id           String     @id @default(uuid())
  tournamentId String
  name         String
  exactScore   Int        @default(3)
  correctSide  Int        @default(1)
  wrongResult  Int        @default(0)
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)

  @@index([tournamentId, isActive])
}

model Group {
  id           String            @id @default(uuid())
  tournamentId String
  ownerId      String
  name         String
  inviteCode   String            @unique
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  tournament   Tournament        @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  owner        User              @relation("GroupOwner", fields: [ownerId], references: [id])
  memberships  GroupMembership[]
  shareCards   ShareCard[]

  @@index([tournamentId])
  @@index([ownerId])
}

model GroupMembership {
  id        String    @id @default(uuid())
  groupId   String
  userId    String
  role      GroupRole @default(MEMBER)
  joinedAt  DateTime  @default(now())

  group     Group     @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([groupId, userId])
  @@index([userId])
  @@index([role])
}

model RankingEntry {
  id               String       @id @default(uuid())
  tournamentId     String
  userId           String
  scope            RankingScope
  scopeId          String
  position         Int
  totalPoints      Int          @default(0)
  exactPredictions Int          @default(0)
  predictionsCount Int          @default(0)
  lastScoredAt     DateTime?
  updatedAt        DateTime     @updatedAt

  tournament       Tournament   @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  user             User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, scope, scopeId, userId])
  @@index([tournamentId, scope, scopeId, position])
  @@index([tournamentId, scope, scopeId, totalPoints, exactPredictions, predictionsCount])
  @@index([userId])
}

model ShareCard {
  id           String        @id @default(uuid())
  type         ShareCardType
  tournamentId String
  userId       String
  matchId      String?
  groupId      String?
  imageUrl     String?
  payload      Json
  createdAt    DateTime      @default(now())

  tournament   Tournament    @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  match        Match?        @relation(fields: [matchId], references: [id], onDelete: SetNull)
  group        Group?        @relation(fields: [groupId], references: [id], onDelete: SetNull)

  @@index([tournamentId, type])
  @@index([userId])
  @@index([matchId])
  @@index([groupId])
}
```

## Critical Constraints

### Auth0 Identity Mapping

```prisma
@@unique([authProvider, authSubject])
```

Prevents the same Auth0 identity from creating duplicate internal users.

### Prediction Uniqueness

```prisma
@@unique([userId, matchId])
```

Enforces the core rule: one prediction per user per match.

### Group Membership Uniqueness

```prisma
@@unique([groupId, userId])
```

Prevents duplicate membership in the same private group.

### Ranking Entry Uniqueness

```prisma
@@unique([tournamentId, scope, scopeId, userId])
```

Allows one ranking row per user per tournament/scope.

## Confirmed Ranking Strategy

### Tie-breakers

Ranking entries are ordered by:

```txt
1. totalPoints DESC
2. exactPredictions DESC
3. predictionsCount DESC
4. lastScoredAt ASC
5. userId ASC
```

`lastScoredAt` should represent the latest scored prediction timestamp contributing to the user's ranking entry.

### Position Model

WorldPredict uses dense ranking for MVP:

```txt
1, 2, 2, 3
```

This is friendlier for users and especially useful in small private groups.

## Confirmed Jobs and Admin Strategy

### Job Runner

Critical jobs use **BullMQ + Redis**:

- MatchStatusUpdateJob
- ScoreFinalizedMatchJob
- RecalculateRankingsJob

### Finalization

MVP match finalization is manual/admin-first.

A match is scoreable only when:

```txt
status = FINISHED
homeScore IS NOT NULL
awayScore IS NOT NULL
finalizedAt IS NOT NULL
```

### Idempotency

Scoring jobs only process predictions with:

```txt
scoringStatus = PENDING
```

Ranking recalculation should aggregate official scored predictions and upsert `RankingEntry` rows.

### Admin

MVP uses protected admin endpoints before an admin dashboard.

Admin endpoints should support:

- tournament data management
- team management
- match management
- match finalization
- manual job triggering if needed

## Recommended Indexes

### Match Reads

```prisma
@@index([tournamentId, kickoffAt])
@@index([status])
```

Supports fixture listing and status-based filtering.

### Prediction Processing

```prisma
@@index([matchId])
@@index([scoringStatus])
```

Supports scoring jobs for finalized matches.

### Ranking Reads

```prisma
@@index([tournamentId, scope, scopeId, position])
```

Supports ranking pages ordered by position.

### Group Access

```prisma
@@index([ownerId])
@@index([userId])
```

Supports group ownership and membership lookups.

## Confirmed Schema Decisions

### Username Uniqueness

Decision:

```prisma
username String @unique
```

WorldPredict will use a globally unique username for MVP simplicity.

### Country Representation

Decision:

```prisma
country String?
```

Country will be stored as an ISO country code string such as `AR`, `UY`, `BR`, or `ES`.

No separate `Country` table is needed for MVP.

### Favorite Team Representation

Decision:

```prisma
favoriteTeamId String?
favoriteTeam   Team?
```

Favorite team will be represented as a nullable relation to `Team`.

Reasoning:

- Keeps visual identity consistent.
- Supports flags/colors/share cards.
- Avoids free-text inconsistency.

### Ranking Scope ID

Decision:

```prisma
scopeId String
```

`scopeId` will use sentinel/string values instead of null.

Examples:

- GLOBAL → `scopeId = "global"`
- GROUP → `scopeId = group.id`
- COUNTRY → `scopeId = countryCode`

Reasoning:

- Avoids PostgreSQL nullable unique constraint surprises.
- Keeps ranking uniqueness simple and predictable.

### Scoring Rules Flexibility

Decision:

Scoring rules will use explicit columns for MVP:

- exact score
- correct side/draw
- wrong result

Future scoring complexity may require a JSON configuration or separate rule table, but not for MVP.

### Share Card Payload

Decision:

`ShareCard.payload` is a generated visual snapshot, not a source of truth.

Official data remains in:

- predictions
- ranking entries
- groups
- matches

This allows old cards to continue representing the moment when they were generated, even if rankings later change.

## Remaining Open Questions

No blocking schema questions remain before converting this draft into an initial `schema.prisma`.

Future implementation may still refine:

- exact ranking tie-breakers
- scoring rule expansion
- share card rendering/cache strategy
- country metadata source

## Migration Notes

### MVP Migration 001

Initial migration should include:

- enums
- all core tables
- unique constraints
- indexes

### Seed Data

Initial seed should include:

- active tournament
- participating teams/countries
- initial matches or sample fixture
- active scoring rule

### Test Data

Testing should include fixtures for:

- exact score prediction
- correct winner prediction
- draw prediction
- wrong prediction
- group ranking
- duplicate prediction rejection
- duplicate group membership rejection

### Seed Strategy

Initial development seed should include:

- one demo tournament
- a small set of teams/countries
- sample matches
- default scoring rule

Demo users and groups should be optional and limited to local/test environments.

## Implementation Notes

### Prisma + NestJS

Use a dedicated `PrismaModule` and `PrismaService`.

Domain modules should not instantiate Prisma directly. They should receive services/repositories through dependency injection.

### Raw SQL Escape Hatch

For ranking recalculation, Prisma can be used initially.

If ranking logic becomes complex or slow, use controlled raw SQL behind `RankingsModule` boundaries.

### Avoid Client-side Authority

The frontend must never calculate official points or ranking positions.

It can display projected feedback, but official scoring and ranking belong to the backend.
