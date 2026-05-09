PRD — World Prediction Platform (PWA)
Product Requirements Document

Project Name: WorldPredict
Type: Social Football Prediction Platform (PWA)
Target: FIFA World Cup 2026 + reusable tournament engine
Methodology: SDD + TDD + Multi-Agent Development
Primary Platform: Mobile-first Web PWA
Languages: Spanish / English
Version: MVP v1

1. Product Vision

Create a viral football prediction platform where users compete by predicting match results during international tournaments.

The platform must:

work on mobile and desktop,
be installable as a PWA,
support competitive rankings,
encourage daily engagement,
and be reusable for future tournaments.

This is NOT a betting platform.

The product focuses on:

competition,
social interaction,
gamification,
retention,
and future monetization.

2. Business Goals
Short-term Goals
Launch before FIFA World Cup 2026.
Validate engagement and retention.
Build an active user base.
Test viral mechanics through private groups.
Mid-term Goals
Reuse the platform for:
Copa América
Champions League
Libertadores
National leagues
eSports tournaments
Long-term Goals
Monetization through:
Ads
Sponsored leagues
Premium groups
Premium stats
Branded tournaments
Fantasy integrations

3. Core Product Principles
Mobile-first

The platform is designed primarily for smartphone usage.

Fast interaction

Predictions must require minimal friction.

Social competition

Rankings and private groups are core retention mechanics.

Tournament engine

Architecture must support multiple tournaments in future versions.

Scalable backend

The system must support traffic spikes during live matches.

4. MVP Scope (Phase 1)
4.1 Authentication
Features
Email/password login
Google login
Apple login
Password recovery
JWT/session handling
User Profile
Username
Country
Avatar
Favorite team
Preferred language
4.2 Tournament Fixture
Features
Match list
Match details
Match status:
Upcoming
Live
Finished
Match Information
Teams
Date/time
Stadium
Group/stage
Score
Events (future phase)
4.3 Prediction System
Core Predictions

Users can predict:

Home score
Away score
Rules
Predictions close at kickoff.
Users can edit predictions before kickoff.
Only one prediction per match.
4.4 Scoring System
Base Scoring

Example:

Exact score → 3 pts
Correct winner/draw → 1 pt
Wrong prediction → 0 pts

Scoring rules must be configurable.

Processing
Automatic scoring after match finalization.
Backend recalculates rankings automatically.
4.5 Rankings
MVP Rankings
Global
Country
Private groups
Ranking Data
Total points
Exact predictions
Prediction accuracy
Position changes
4.6 Private Groups
Features
Create group
Invitation code
Join group
Group ranking
Group Roles
Owner
Member
4.7 User Profile & Stats
User Data
Total points
Accuracy %
Best streak
Exact predictions count
Ranking history
4.8 Notifications
MVP Notifications
Match starting soon
Prediction deadline
Match results
Channels
Web Push
In-app notifications
4.9 PWA
Requirements
Installable
Responsive
Offline asset caching
App-like navigation
Splash screen
Manifest support
NOT included in MVP
Full offline functionality
Offline prediction sync
4.10 Internationalization
Supported Languages
Spanish
English

Architecture must support future translations.

5. Future Features (Post-MVP)
5.1 Advanced Predictions
Goal scorers
Cards
Penalties
Corners
Possession
5.2 Trivia Mode
Daily football trivia
Streak system
XP rewards
5.3 Gamification
XP levels
Achievements
Badges
Seasonal rewards
5.4 Social Features
Friends
Comments
Prediction sharing
Activity feed
5.5 Monetization
Google AdMob
Premium memberships
Sponsored tournaments
6. Technical Architecture
Frontend
Stack
React
Next.js
TypeScript
TailwindCSS
Zustand
React Query
PWA
Service Workers
Web Manifest
Push Notifications
Backend
Stack
Node.js
TypeScript
Firebase Functions OR NestJS
Responsibilities
Auth validation
Prediction processing
Ranking calculations
Scheduled jobs
Notification dispatch
Database
Preferred

Firebase Firestore

Collections
users
tournaments
matches
predictions
rankings
groups
notifications
External APIs
Sports Data

Examples:

API-Football
SportMonks
Football-Data

The system must abstract provider integration.

7. Non-Functional Requirements
Performance
Initial load < 3s
Mobile optimized
Lazy loading
Scalability
Handle concurrent spikes during matches
Read-heavy optimized architecture
Security
Secure auth
Rate limiting
Input validation
Anti-spam protections
Reliability
Automatic retries for API failures
Match synchronization fallback jobs
8. Data Model Overview
User
id
username
email
country
avatar
favoriteTeam
stats
Match
id
tournamentId
homeTeam
awayTeam
kickoff
status
result
Prediction
userId
matchId
homeScore
awayScore
pointsAwarded
Group
id
ownerId
inviteCode
members
Ranking
userId
points
exactPredictions
accuracy
9. MVP User Flow
New User
Open app
Register/login
Select country
Join/create group
Predict matches
Earn points
Compete in rankings
10. Recommended Development Strategy
Phase 1 — Foundation
Authentication
Database
Tournament sync
Core UI
PWA base
Estimated

2 weeks

Phase 2 — Core Gameplay
Predictions
Scoring
Rankings
Groups
Estimated

3–4 weeks

Phase 3 — Polish
Notifications
Stats
Optimization
Multi-language
QA
Estimated

2–3 weeks

Total MVP Estimate
Solo developer

6–10 weeks

With AI agents + SDD workflow

4–7 weeks realistic

11. Recommended SDD Agent Structure
sdd-Orchestrator
Architecture decisions
Task coordination
PR reviews
sdd-spec
Domain modeling
API contracts
Scoring rules
sdd-design
UI system
UX flows
Responsive layouts
sdd-apply
Feature implementation
Refactors
Unit tests
sdd-verify
TDD validation
Integration testing
Performance review
sdd-archive
Documentation
ADRs
Changelogs
12. Recommended MCP Integrations
Essential
GitHub MCP
Filesystem MCP
PostgreSQL/Firebase MCP
Browser automation MCP
Figma MCP (optional)
13. Suggested Initial Repository Structure
/apps
  /web

/packages
  /ui
  /shared
  /types
  /config

/backend
  /functions
  /jobs
  /ranking-engine

/docs
  PRD.md
  TECHNICAL_ARCHITECTURE.md
  ADR/

14. Success Metrics
MVP KPIs
Daily active users
Prediction completion rate
Group creation rate
Push notification CTR
User retention
Average predictions per user
15. Final Product Direction

The long-term goal is not only a World Cup predictor.

The objective is building a reusable competitive tournament platform capable of supporting:

football,
esports,
fantasy systems,
social prediction mechanics,
and tournament communities at scale.