# Tournament Context Specification

## Purpose

Define phase-1 multi-tournament behavior so the application can expose a global tournament selector, persist the user's choice, resolve tournament context from that choice before falling back to the ACTIVE tournament, and keep existing tournament-scoped experiences working without introducing route-based tournament UX yet.

## Requirements

### Requirement: Global app shell tournament selector

The system MUST expose a tournament selector in the global application shell so users can see and change the current tournament context without navigating to a dedicated settings flow.

#### Scenario: Selector is visible from the shared shell

- GIVEN a user is on a web surface rendered inside the global application shell
- WHEN the shell is displayed
- THEN the system SHALL show a tournament selector in that shell
- AND the selector SHALL present the current tournament context as the selected option
- AND the selector SHALL present available tournaments that the current environment supports for manual selection

#### Scenario: Selector reflects persisted choice on a later visit

- GIVEN a user previously selected a tournament and that selection was persisted successfully
- WHEN the user later returns to a shell-backed surface
- THEN the selector SHALL render with that previously selected tournament as the current option

### Requirement: Tournament selection cookie persistence

The system MUST persist tournament selection in a cookie so web requests and server-rendered flows can reuse the user's chosen tournament context across visits.

#### Scenario: Persist selected tournament after user change

- GIVEN a user changes the tournament in the selector
- WHEN the selection is accepted
- THEN the system SHALL write a cookie containing the selected tournament identifier
- AND subsequent web requests from that user SHALL include the same selected tournament context until the cookie is changed or removed

#### Scenario: Ignore malformed persisted tournament cookie

- GIVEN the request contains a malformed, empty, or otherwise unreadable tournament-selection cookie
- WHEN the system resolves the current tournament context
- THEN the system MUST treat that cookie as invalid
- AND the system MUST continue using fallback tournament resolution instead of failing the request

### Requirement: Tournament context resolution prefers selected tournament

The system MUST resolve tournament context by preferring a valid selected tournament from request context and falling back to the ACTIVE tournament when the selected value is missing or invalid.

#### Scenario: Selected tournament overrides ACTIVE fallback

- GIVEN the request context contains a valid selected tournament identifier
- AND that tournament exists
- WHEN a tournament-scoped service resolves tournament context without an explicit tournament override
- THEN the system SHALL use the selected tournament
- AND the system SHALL NOT replace it with a different ACTIVE tournament

#### Scenario: Missing selection falls back to ACTIVE tournament

- GIVEN the request context does not contain a selected tournament identifier
- WHEN a tournament-scoped service resolves tournament context without an explicit tournament override
- THEN the system SHALL use the ACTIVE tournament

#### Scenario: Unknown selected tournament falls back to ACTIVE tournament

- GIVEN the request context contains a selected tournament identifier
- AND no tournament exists for that identifier
- WHEN a tournament-scoped service resolves tournament context without an explicit tournament override
- THEN the system MUST ignore the invalid selection
- AND the system SHALL use the ACTIVE tournament instead

### Requirement: Seed and provider tournament sources remain separate

The system MUST keep demo or manual tournaments separate from provider-backed real tournaments in seed and configuration strategy so demo fixtures do not implicitly become the provider import target.

#### Scenario: Demo and provider-backed tournaments coexist without being conflated

- GIVEN the environment includes a demo or manually maintained tournament and a provider-backed real tournament
- WHEN seed data and provider configuration are prepared for phase 1
- THEN the system SHALL preserve both tournament records as distinct tournaments
- AND provider synchronization configuration SHALL target the provider-backed tournament context rather than assuming the demo tournament is the provider source

#### Scenario: Manual demo tournament remains usable without provider coupling

- GIVEN a tournament exists only for demo or manual operation
- WHEN tournament context is resolved to that tournament
- THEN the system SHALL allow tournament-scoped read and prediction experiences to use it
- AND the absence of provider-backed sync configuration for that tournament SHALL NOT invalidate the selection by itself

### Requirement: Existing tournament-scoped surfaces honor resolved context

The system MUST keep existing tournament-scoped surfaces operating under the resolved tournament context so phase 1 changes do not break current experiences.

#### Scenario: Core user-facing surfaces use selected tournament context

- GIVEN the resolved tournament context is a valid selected tournament
- WHEN the user accesses dashboard matches, predictions, groups, rankings, or share-card flows
- THEN each surface SHALL read and write tournament-scoped data for that resolved tournament context
- AND each surface SHALL continue to behave as it did before apart from using the resolved tournament instead of assuming only the ACTIVE tournament

#### Scenario: Admin sports-data diagnostics and sync flows use appropriate tournament context

- GIVEN the resolved tournament context is a valid selected tournament
- WHEN an admin accesses sports-data diagnostics or sync-related surfaces without supplying an explicit tournament override
- THEN the system SHALL scope default tournament resolution to the resolved tournament context where that surface is tournament-scoped
- AND sync operations that already accept an explicit tournament identifier MAY continue to honor that explicit override ahead of the resolved context

#### Scenario: ACTIVE fallback preserves existing surfaces

- GIVEN the selected tournament context is missing or invalid
- WHEN a user or admin accesses an existing tournament-scoped surface
- THEN the system SHALL continue operating against the ACTIVE tournament
- AND the surface SHALL remain functional without requiring new route parameters or manual recovery steps

## Non-Goals

The following items are explicitly out of scope for phase 1 and MUST NOT be required for this change to be considered complete:

- Slug-based or route-based tournament addressing such as `/tournament/:slug/*`
- URL synchronization or deep-link preservation for the selected tournament
- Full multi-tournament UX expansion beyond the global selector and compatibility updates
- Dedicated management UX for administering multiple tournaments
- Historical browsing, archive navigation, or tournament-specific caching expansions
