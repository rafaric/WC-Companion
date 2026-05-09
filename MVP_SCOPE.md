# WorldPredict — MVP Scope

## Product Positioning

WorldPredict is a social football prediction platform for international tournaments, starting with the FIFA World Cup 2026.

It is **not** a betting product. The core value is friendly competition, social groups, rankings, and shareable moments.

## MVP Goal

Validate whether users repeatedly return to predict matches, compete with friends, and share their performance.

The MVP must prove this loop:

```txt
User joins → predicts matches → earns points → climbs ranking → shares result → invites friends
```

## Primary MVP Audience

- Football fans following the World Cup.
- Friend groups that already compete informally over match results.
- Users arriving from WhatsApp, Instagram, X/Twitter, or Discord share links.

## Core MVP Principles

### Mobile-first

The product must feel natural on a smartphone. Desktop is supported, but not the primary design target.

### Fast prediction flow

Making or editing a prediction must be low friction and take only a few seconds.

### Social competition first

Private groups and rankings are not secondary features. They are the main retention mechanic.

### Viral sharing from day one

Shareable cards are part of the MVP because they support organic acquisition.

### Reusable tournament foundation

The first release targets the World Cup, but the domain should not be hardcoded only for that tournament.

## MVP Feature Set

### 1. Landing + Authentication

#### Included

- Short mobile-first landing page.
- Clear CTA: start predicting, create group, or join group.
- Email/password authentication.
- Google authentication if implementation cost stays low.
- Session handling.
- Basic profile creation.

#### Profile Fields

- Username.
- Country.
- Favorite team or country.
- Avatar.
- Preferred language.

#### Deferred

- Apple login.
- Advanced profile customization.
- Account deletion self-service flow.
- Complex user preferences.

### 2. Tournament Fixture

#### Included

- Active tournament.
- Match list.
- Match details.
- Match status:
  - upcoming
  - live
  - finished
- Team/country display.
- Kickoff date/time.
- Stage or group.
- Final score after completion.

#### Deferred

- Detailed match events.
- Lineups.
- Cards, corners, possession, and advanced stats.
- Multiple sports providers in production mode.

### 3. Prediction System

#### Included

- Predict home score and away score.
- Edit prediction before kickoff.
- One prediction per user per match.
- Prediction closes at kickoff.
- Basic prediction confirmation feedback.

#### Deferred

- Goal scorer predictions.
- Cards/corners predictions.
- Penalty shootout predictions.
- Offline prediction sync.

### 4. Scoring Engine

#### Included

Default scoring rules:

- Exact score: 3 points.
- Correct winner/draw: 1 point.
- Wrong prediction: 0 points.

The scoring engine must be isolated and testable.

#### Required Behavior

- Score predictions after match finalization.
- Be idempotent: re-running scoring must not duplicate points.
- Store points awarded per prediction.
- Support configurable rules for future tournaments.

#### Deferred

- Streak multipliers.
- Difficulty-based scoring.
- Bonus rounds.
- Advanced tournament-specific scoring presets.

### 5. Rankings

#### Included

- Global ranking.
- Private group ranking.
- Ranking position.
- Total points.
- Exact predictions count.

#### Nice to Have if Cheap

- Country ranking.
- Simple position change indicator.

#### Deferred

- Ranking history.
- Deep accuracy analytics.
- Seasonal leaderboards.
- Advanced filters.

### 6. Private Groups

#### Included

- Create private group.
- Generate invitation code or link.
- Join private group.
- Group owner and member roles.
- Group ranking.

#### Deferred

- Group chat.
- Comments.
- Group challenges.
- Paid/premium groups.

### 7. Shareable Cards

#### Included

- Share prediction card.
- Share group ranking card.
- Share weekly/simple performance card.

#### Card Content

- Username.
- Country flag.
- Ranking position.
- Points.
- Exact predictions count.
- Match prediction or group position.

#### Initial Platforms

- WhatsApp.
- Instagram Stories-friendly format.
- X/Twitter.
- Discord.

#### Deferred

- Complex animated cards.
- Full personalization editor.
- Sponsored branded cards.

### 8. PWA Base

#### Included

- Responsive mobile-first layout.
- Web manifest.
- Installable app shell.
- Basic static asset caching.

#### Deferred

- Full offline mode.
- Offline prediction queue.
- Advanced service worker strategies.

### 9. Internationalization

#### Included

- Architecture prepared for Spanish and English.
- Initial copy may prioritize Spanish if speed is needed.

#### Deferred

- Full translation management workflow.
- Additional languages.

## MVP Landing Page Decision

The MVP should use a **short landing page with login/register CTA**, not direct login only.

Reason: users may arrive from shared cards or invitation links and need immediate context before signing in.

### Landing Sections

1. Hero: core promise.
2. CTA: start predicting.
3. Three-step explanation:
   - Predict matches.
   - Earn points.
   - Compete with friends.
4. Visual preview of prediction/ranking.
5. Login/register entry point.

## MVP Exclusions

The following are intentionally outside the first MVP:

- Apple login.
- Web push notifications.
- Full offline behavior.
- Trivia mode.
- Achievements and badges.
- XP system.
- Comments and activity feed.
- Advanced sports statistics.
- Multi-provider production sync.
- Monetization.
- Premium memberships.
- Sponsored tournaments.

## First Vertical Slice

The first implementation slice should be:

```txt
User registers → sees fixture → predicts match → match is finalized → prediction is scored → ranking updates
```

This slice validates the real product engine before investing heavily in polish.

## Asset Generation Timing

Visual assets should not be generated before core flows and UI hierarchy are clear.

Recommended order:

1. MVP scope.
2. Domain model.
3. Technical strategy.
4. First UX flows.
5. Branding direction.
6. Landing visuals.
7. Share card templates.
8. Animation/microinteraction design.
