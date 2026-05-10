# WorldPredict — MVP API Contract

## Purpose

This document describes the current MVP backend API used by the future frontend.

It reflects the implemented backend state after the MVP smoke flow passed successfully.

## Base Assumptions

- Backend framework: NestJS.
- Auth provider: Auth0.
- API auth: Bearer Auth0 access token.
- Backend does not issue proprietary JWTs.
- Dates are returned as ISO strings in JSON.
- Official scoring and ranking are backend-owned.
- Frontend must not calculate official points or positions.

## Authentication

Protected endpoints require:

```http
Authorization: Bearer <auth0_access_token>
```

The backend validates the token and maps Auth0 identity to an internal `User`.

## Public Endpoints

### Health Check

```http
GET /health
```

#### Response

```json
{
  "status": "ok"
}
```

### Get Active Tournament

```http
GET /tournaments/active
```

#### Response

```json
{
  "id": "tournament-id",
  "name": "World Cup 2026 Demo",
  "slug": "world-cup-2026-demo",
  "year": 2026,
  "status": "ACTIVE",
  "startsAt": null,
  "endsAt": null
}
```

### Get Active Tournament Matches

```http
GET /tournaments/active/matches
```

Ordered by `kickoffAt ASC`.

#### Response

```json
[
  {
    "id": "match-id",
    "tournamentId": "tournament-id",
    "stage": "Group Stage",
    "groupName": "Group A",
    "kickoffAt": "2026-06-11T16:00:00.000Z",
    "status": "UPCOMING",
    "homeScore": null,
    "awayScore": null,
    "finalizedAt": null,
    "homeTeam": {
      "id": "team-id",
      "name": "Argentina",
      "shortName": "ARG",
      "countryCode": "AR",
      "flagCode": "ARG",
      "colors": {
        "primaryColor": "#74ACDF",
        "secondaryColor": "#F6E7A1"
      }
    },
    "awayTeam": {
      "id": "team-id",
      "name": "England",
      "shortName": "ENG",
      "countryCode": "GB-ENG",
      "flagCode": "ENG",
      "colors": {
        "primaryColor": "#FFFFFF",
        "secondaryColor": "#CE1124"
      }
    }
  }
]
```

### Get Global Ranking

```http
GET /rankings/global
```

Uses the active tournament.

#### Response

```json
[
  {
    "position": 1,
    "userId": "user-id",
    "username": "rafa",
    "avatar": null,
    "country": "AR",
    "favoriteTeamId": "team-id",
    "totalPoints": 12,
    "exactPredictions": 4,
    "predictionsCount": 4,
    "lastScoredAt": "2026-06-11T20:00:00.000Z",
    "updatedAt": "2026-06-11T20:01:00.000Z"
  }
]
```

## Protected User Endpoints

### Get Current User

```http
GET /users/me
Authorization: Bearer <token>
```

Syncs the Auth0 identity into an internal user if needed.

#### Response

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "username": "rafa",
  "country": "AR",
  "favoriteTeamId": "team-id",
  "avatar": null,
  "preferredLanguage": "es",
  "createdAt": "2026-05-08T12:00:00.000Z",
  "updatedAt": "2026-05-08T12:00:00.000Z"
}
```

### Update Current User Profile

```http
PATCH /users/me/profile
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request

```json
{
  "country": "AR",
  "favoriteTeamId": "team-id",
  "preferredLanguage": "es"
}
```

#### Validation

- `country`: ISO alpha-2 uppercase code, e.g. `AR`, `UY`, `BR`, `ES`.
- `preferredLanguage`: `es` or `en`.
- `favoriteTeamId`: must exist in the active tournament.

#### Response

Returns the same shape as `GET /users/me`.

## Protected Prediction Endpoints

### Submit or Update Prediction

```http
PUT /predictions/matches/:matchId
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request

```json
{
  "homeScore": 2,
  "awayScore": 1
}
```

#### Rules

- Scores must be non-negative integers.
- Match must exist.
- Match must be `UPCOMING`.
- Current time must be before `kickoffAt`.
- One prediction per user/match.
- Calling this endpoint again before kickoff edits the existing prediction.
- Edits reset `pointsAwarded` to `0` and `scoringStatus` to `PENDING`.

#### Response

```json
{
  "id": "prediction-id",
  "matchId": "match-id",
  "tournamentId": "tournament-id",
  "homeScore": 2,
  "awayScore": 1,
  "pointsAwarded": 0,
  "scoringStatus": "PENDING",
  "submittedAt": "2026-05-08T12:00:00.000Z",
  "updatedAt": "2026-05-08T12:00:00.000Z",
  "scoredAt": null
}
```

### Get My Predictions

```http
GET /predictions/me
Authorization: Bearer <token>
```

Returns only the authenticated user's predictions.

Ordered by:

```txt
updatedAt DESC
submittedAt DESC
```

#### Response

```json
[
  {
    "id": "prediction-id",
    "matchId": "match-id",
    "tournamentId": "tournament-id",
    "homeScore": 2,
    "awayScore": 1,
    "pointsAwarded": 3,
    "scoringStatus": "SCORED",
    "submittedAt": "2026-05-08T12:00:00.000Z",
    "updatedAt": "2026-05-08T12:00:00.000Z",
    "scoredAt": "2026-05-08T14:00:00.000Z"
  }
]
```

## Protected Group Endpoints

### Create Group

```http
POST /groups
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request

```json
{
  "name": "Los Pibes del Mundial"
}
```

#### Rules

- Group name is required.
- Group name max length: 80 characters.
- Group belongs to the active tournament.
- Creator becomes group owner and member.

#### Response

```json
{
  "id": "group-id",
  "name": "Los Pibes del Mundial",
  "inviteCode": "ABC123XYZ",
  "tournamentId": "tournament-id",
  "createdAt": "2026-05-08T12:00:00.000Z"
}
```

### Join Group

```http
POST /groups/join
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request

```json
{
  "inviteCode": "ABC123XYZ"
}
```

#### Rules

- Invite code is normalized to uppercase.
- Joining is idempotent if already a member.

#### Response

Returns the group view.

### Get My Groups

```http
GET /groups/me
Authorization: Bearer <token>
```

#### Response

```json
[
  {
    "id": "group-id",
    "name": "Los Pibes del Mundial",
    "inviteCode": "ABC123XYZ",
    "tournamentId": "tournament-id",
    "createdAt": "2026-05-08T12:00:00.000Z",
    "role": "OWNER"
  }
]
```

### Get Group Ranking

```http
GET /groups/:groupId/ranking
Authorization: Bearer <token>
```

#### Rules

- User must be a group member.
- Non-members receive `403 Forbidden`.

#### Response

Same entry shape as global ranking.

## Protected Share Card Endpoints

Share card endpoints create payload snapshots. They do not render image files yet.

### Create My Global Ranking Share Card

```http
POST /share-cards/me/global-ranking
Authorization: Bearer <token>
```

#### Rules

- User must have a global ranking entry.

#### Response

```json
{
  "id": "share-card-id",
  "type": "PERFORMANCE_SUMMARY",
  "imageUrl": null,
  "payload": {
    "cardType": "PERFORMANCE_SUMMARY",
    "tournamentName": "World Cup 2026 Demo",
    "tournamentYear": 2026,
    "username": "rafa",
    "country": "AR",
    "avatar": null,
    "position": 1,
    "totalPoints": 12,
    "exactPredictions": 4,
    "predictionsCount": 4,
    "generatedAt": "2026-05-08T12:00:00.000Z"
  },
  "createdAt": "2026-05-08T12:00:00.000Z"
}
```

### Create Group Ranking Share Card

```http
POST /share-cards/groups/:groupId/ranking
Authorization: Bearer <token>
```

#### Rules

- User must be a group member.
- User must have a ranking entry in that group.

#### Response

Same as global share card, with:

```json
{
  "type": "GROUP_RANKING",
  "payload": {
    "cardType": "GROUP_RANKING",
    "groupName": "Los Pibes del Mundial"
  }
}
```

### Create Prediction Share Card

```http
POST /share-cards/predictions/matches/:matchId
Authorization: Bearer <token>
```

#### Rules

- User must have a saved prediction for the match.
- The card stores a payload snapshot only; image rendering is still future work.

#### Response

```json
{
  "id": "share-card-id",
  "type": "PREDICTION",
  "imageUrl": null,
  "payload": {
    "cardType": "PREDICTION",
    "tournamentName": "World Cup 2026 Demo",
    "tournamentYear": 2026,
    "username": "rafa",
    "country": "AR",
    "avatar": null,
    "matchId": "match-id",
    "predictionId": "prediction-id",
    "homeTeamName": "Argentina",
    "homeTeamShortName": "ARG",
    "homeTeamCountryCode": "AR",
    "awayTeamName": "Brazil",
    "awayTeamShortName": "BRA",
    "awayTeamCountryCode": "BR",
    "predictedHomeScore": 2,
    "predictedAwayScore": 1,
    "pointsAwarded": 0,
    "scoringStatus": "PENDING",
    "stage": "Group Stage",
    "groupName": "Group A",
    "kickoffAt": "2026-06-11T16:00:00.000Z",
    "predictionUpdatedAt": "2026-05-08T12:00:00.000Z",
    "generatedAt": "2026-05-08T12:00:00.000Z"
  },
  "createdAt": "2026-05-08T12:00:00.000Z"
}
```

## Admin Endpoint

### Finalize Match

```http
PATCH /admin/matches/:matchId/finalize
Authorization: Bearer <token>
Content-Type: application/json
```

#### Important

This endpoint requires a valid Auth0 token plus the `matches:finalize` permission.

Do not expose it publicly without the permission guard in place.

#### Request

```json
{
  "homeScore": 2,
  "awayScore": 1
}
```

#### Behavior

```txt
mark match FINISHED
→ set score/finalizedAt
→ score pending predictions
→ recalculate global ranking
→ recalculate group rankings for the tournament
```

#### Response

```json
{
  "matchId": "match-id",
  "tournamentId": "tournament-id",
  "scoringSummary": {
    "matchId": "match-id",
    "tournamentId": "tournament-id",
    "scoringRuleId": "rule-id",
    "pendingCount": 2,
    "processedCount": 2,
    "alreadyScoredCount": 0,
    "scoredAt": "2026-05-08T12:00:00.000Z"
  },
  "globalRankingSummary": {
    "scope": "GLOBAL",
    "scopeId": "global",
    "tournamentId": "tournament-id",
    "processedCount": 2
  },
  "groupRankingSummaries": [
    {
      "scope": "GROUP",
      "scopeId": "group-id",
      "tournamentId": "tournament-id",
      "processedCount": 2
    }
  ]
}
```

### Confirm Staged External Match Result

```http
POST /admin/sports-data/external-results/:externalMatchResultId/confirm
Authorization: Bearer <token>
```

#### Important

This endpoint requires a valid Auth0 token plus the `matches:finalize` permission.

#### Behavior

```txt
load staged external result
→ require PENDING_CONFIRMATION
→ require linked internal matchId
→ finalize the internal match through MatchesService.finalizeMatch()
→ mark the external result CONFIRMED and store confirmedAt
```

#### Response

```json
{
  "externalMatchResultId": "external-result-id",
  "externalMatchId": "fixture-arg-eng",
  "matchId": "match-id",
  "tournamentId": "tournament-id",
  "state": "CONFIRMED",
  "confirmedAt": "2026-05-08T12:00:00.000Z",
  "finalizationSummary": {
    "matchId": "match-id",
    "tournamentId": "tournament-id",
    "scoringSummary": {
      "matchId": "match-id",
      "tournamentId": "tournament-id",
      "scoringRuleId": "rule-id",
      "pendingCount": 2,
      "processedCount": 2,
      "alreadyScoredCount": 0,
      "scoredAt": "2026-05-08T12:00:00.000Z"
    },
    "globalRankingSummary": {
      "scope": "GLOBAL",
      "scopeId": "global",
      "tournamentId": "tournament-id",
      "processedCount": 2
    },
    "groupRankingSummaries": []
  }
}
```

### List Pending Staged External Match Results

```http
GET /admin/sports-data/external-results?state=PENDING_CONFIRMATION
Authorization: Bearer <token>
```

Returns staged results with provider, external match ID, timestamps, proposed score, and linked internal match context when available.

#### Response

```json
[
  {
    "id": "external-result-id",
    "providerKey": "mock",
    "externalMatchId": "fixture-arg-eng",
    "matchId": "match-id",
    "state": "PENDING_CONFIRMATION",
    "homeScore": 2,
    "awayScore": 1,
    "playedAt": "2026-06-11T19:00:00.000Z",
    "stagedAt": "2026-05-08T12:00:00.000Z",
    "confirmedAt": null,
    "discardedAt": null,
    "match": {
      "matchId": "match-id",
      "status": "UPCOMING",
      "kickoffAt": "2026-06-11T16:00:00.000Z",
      "homeTeamName": "Argentina",
      "awayTeamName": "England",
      "stage": "Group Stage",
      "groupName": "Group A"
    }
  }
]
```

#### Admin UI

The web app exposes an admin review page at `/admin/external-results` for users with the `matches:finalize` permission.

## Recommended Frontend Flow

### First Load

```txt
GET /tournaments/active
GET /tournaments/active/matches
GET /rankings/global
```

If authenticated:

```txt
GET /users/me
GET /predictions/me
GET /groups/me
```

### Onboarding

```txt
GET /tournaments/active/matches
PATCH /users/me/profile
```

Use teams from match data for favorite team selection in MVP.

### Prediction Flow

```txt
GET /tournaments/active/matches
GET /predictions/me
PUT /predictions/matches/:matchId
```

Frontend merges predictions by `matchId`.

### Group Flow

```txt
POST /groups
POST /groups/join
GET /groups/me
GET /groups/:groupId/ranking
```

### Share Flow

```txt
POST /share-cards/me/global-ranking
POST /share-cards/groups/:groupId/ranking
```

## Known MVP Limitations

- No pagination on ranking endpoints yet.
- No real admin-role authorization yet.
- Share cards generate payload snapshots only, not images.
- Fixture endpoint does not include user's prediction; frontend should merge with `GET /predictions/me`.
- Country is stored as ISO alpha-2 string, not a country table.
- Exact prediction count is inferred from scoring points in ranking recalculation for MVP rules.
