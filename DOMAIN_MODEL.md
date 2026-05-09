# WorldPredict — Domain Model

## Domain Summary

WorldPredict is built around tournament prediction loops.

The core domain is not UI, authentication, or sports data ingestion. The core domain is:

```txt
Tournament → Match → Prediction → Score → Ranking → Group Competition → Sharing
```

## Core Concepts

### User

A participant in the platform.

#### Attributes

- id
- username
- email
- country
- favoriteTeam
- avatar
- preferredLanguage
- createdAt
- updatedAt

#### Rules

- Username should be unique or display-safe.
- A user can join multiple groups.
- A user can submit one prediction per match.

### Tournament

A competition containing matches and scoring configuration.

#### Attributes

- id
- name
- slug
- year
- status
- startsAt
- endsAt
- scoringRules

#### Statuses

- draft
- active
- finished

#### Rules

- Only one tournament needs to be active for MVP.
- The model must allow future tournaments without rewriting the whole app.

### Team

A country or team participating in a tournament.

#### Attributes

- id
- name
- shortName
- countryCode
- flagCode
- primaryColor
- secondaryColor

#### Rules

- Avoid relying on copyrighted FIFA branding.
- Prefer country flags and custom styling.

### Match

A scheduled game inside a tournament.

#### Attributes

- id
- tournamentId
- stage
- group
- homeTeamId
- awayTeamId
- kickoffAt
- status
- homeScore
- awayScore
- finalizedAt

#### Statuses

- upcoming
- live
- finished

#### Rules

- Predictions close at kickoff.
- Finished matches can trigger scoring.
- Finalization must be explicit to avoid scoring incomplete data.

### Prediction

A user's predicted score for a match.

#### Attributes

- id
- tournamentId
- matchId
- userId
- homeScore
- awayScore
- pointsAwarded
- scoringStatus
- submittedAt
- updatedAt
- scoredAt

#### Scoring Statuses

- pending
- scored
- void

#### Rules

- A user can have only one prediction per match.
- Prediction can be edited only before kickoff.
- Prediction cannot be edited after match starts.
- Scoring must be idempotent.

### ScoringRule

Defines how predictions are converted into points.

#### MVP Rules

- Exact score: 3 points.
- Correct winner or draw: 1 point.
- Wrong prediction: 0 points.

#### Rules

- Scoring rules belong to a tournament.
- The scoring engine must not depend on UI concerns.
- The same prediction should always produce the same score for the same match result and rules.

### RankingEntry

Precomputed ranking data for fast reads.

#### Attributes

- id
- scope
- scopeId
- tournamentId
- userId
- position
- totalPoints
- exactPredictions
- predictionsCount
- updatedAt

#### Scopes

- global
- group
- country

#### Rules

- Rankings should be read-optimized.
- Ranking recalculation must be repeatable.
- MVP requires global and group rankings.
- Country ranking is optional for MVP if it adds complexity.

### Group

A private competition space.

#### Attributes

- id
- tournamentId
- name
- ownerId
- inviteCode
- createdAt

#### Rules

- Group invite codes must be unique.
- Owner is also a member.
- A group belongs to a tournament for MVP simplicity.

### GroupMembership

Connects users to groups.

#### Attributes

- id
- groupId
- userId
- role
- joinedAt

#### Roles

- owner
- member

#### Rules

- A user cannot join the same group twice.
- Group rankings only include members.

### ShareCard

A generated social asset representing user performance, prediction, or ranking.

#### Types

- prediction
- group-ranking
- performance-summary

#### Attributes

- id
- type
- tournamentId
- userId
- groupId
- matchId
- imageUrl
- payload
- createdAt

#### Rules

- Share cards should be cacheable.
- Cards must avoid betting/casino language.
- Cards should use original visual identity, flags, and custom styling.

## Key Domain Events

These events describe important system changes. They do not require a full event-sourcing implementation for MVP, but they help keep the design clean.

### UserRegistered

Triggered when a new user completes registration.

### ProfileCompleted

Triggered when a user chooses required profile information.

### GroupCreated

Triggered when a user creates a private group.

### GroupJoined

Triggered when a user joins a group via invite code or link.

### PredictionSubmitted

Triggered when a user creates a match prediction.

### PredictionUpdated

Triggered when a user edits a prediction before kickoff.

### MatchStarted

Triggered when a match reaches kickoff/live status.

### MatchFinalized

Triggered when the final score is confirmed.

### PredictionScored

Triggered when a prediction receives points.

### RankingsUpdated

Triggered after ranking recalculation.

### ShareCardGenerated

Triggered after a user requests or creates a shareable card.

## Critical Invariants

### Prediction Uniqueness

There must be at most one prediction per user per match.

### Prediction Locking

Predictions cannot be created or edited after kickoff.

### Scoring Idempotency

Running scoring more than once for the same finalized match must not duplicate points.

### Ranking Consistency

Rankings must reflect scored predictions, not raw submitted predictions.

### Group Membership Uniqueness

A user cannot be a member of the same group more than once.

### No Betting Semantics

The product language must avoid odds, wagers, cashout, bets, gambling, or casino-style metaphors.

## First Use Cases

### Register User

Input:

- email
- password or provider
- username

Output:

- user profile
- active session

### Complete Profile

Input:

- country
- favorite team
- avatar
- preferred language

Output:

- completed user profile

### List Active Tournament Matches

Input:

- tournament id or active tournament

Output:

- upcoming/live/finished matches
- user's prediction if authenticated

### Submit Prediction

Input:

- user id
- match id
- home score
- away score

Output:

- prediction

Validation:

- match exists
- match has not started
- user has not already predicted, or operation is treated as update

### Finalize Match

Input:

- match id
- final home score
- final away score

Output:

- finalized match
- scoring process triggered

### Score Match Predictions

Input:

- finalized match
- tournament scoring rules

Output:

- scored predictions
- updated ranking data

### Create Group

Input:

- owner id
- tournament id
- group name

Output:

- group
- invite code/link
- owner membership

### Join Group

Input:

- user id
- invite code

Output:

- group membership

### Generate Share Card

Input:

- user id
- card type
- optional match/group context

Output:

- shareable image or URL

## Domain Boundaries

### Core Domain

- Prediction rules.
- Scoring engine.
- Ranking updates.
- Group competition.

### Supporting Domain

- Authentication.
- Profile management.
- Sports data synchronization.
- Share card generation.

### Generic Domain

- Email delivery.
- Static asset storage.
- Analytics.
- Logging.
