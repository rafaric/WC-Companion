# Spec Delta — Sports Data Provider

## ADDED Requirements

### Requirement: LPF web provider selection

The system MUST support `SPORTS_DATA_PROVIDER=lpf-web` as a provider selection value.

#### Scenario: Selecting LPF web provider

- **Given** the API starts with `SPORTS_DATA_PROVIDER=lpf-web`
- **When** the sports-data module resolves the active provider
- **Then** it SHALL instantiate the LPF web provider
- **And** it SHALL NOT require API-Sports credentials
- **And** existing `mock`, `football-data`, and `api-sports` provider selection SHALL continue to work

### Requirement: LPF web tournament configuration

The LPF web provider MUST support `liga-argentina-2026` through a configured tournament URL.

#### Scenario: Liga Argentina tournament config exists

- **Given** the LPF web provider receives tournament slug `liga-argentina-2026`
- **When** it resolves provider configuration
- **Then** it SHALL use the official LPF Torneo Apertura 2026 URL by default
- **And** it MAY allow an environment override for local testing

#### Scenario: Unknown tournament slug

- **Given** the LPF web provider receives an unknown tournament slug
- **When** it resolves provider configuration
- **Then** it SHALL reject the request with a clear not-found error

### Requirement: LPF fixture parsing

The LPF web provider MUST parse fixture rows from the official tournament page into provider DTOs.

#### Scenario: Parse final regular match

- **Given** the LPF page contains a row with status `TC`, team names, numeric scores, date, and venue
- **When** the provider lists fixtures
- **Then** it SHALL return a fixture DTO with deterministic external ID
- **And** it SHALL include home and away team external IDs
- **And** it SHALL include kickoff date when parseable
- **And** it SHALL include venue external ID when available

#### Scenario: Parse teams from fixtures

- **Given** the LPF page contains fixture rows with team names
- **When** the provider lists teams
- **Then** it SHALL return one team DTO per distinct team name
- **And** it SHALL generate deterministic external IDs from team names
- **And** it SHALL generate short names without requiring an external API

#### Scenario: Parse venues from fixtures

- **Given** the LPF page contains fixture rows followed by venue names
- **When** the provider lists venues
- **Then** it SHALL return one venue DTO per distinct venue name
- **And** it SHALL skip blank venue names

### Requirement: LPF final-result filtering

The LPF web provider MUST only return normal final results for status `TC`.

#### Scenario: TC match becomes final result

- **Given** the LPF page contains a match row with status `TC` and numeric score
- **When** the provider lists final results
- **Then** it SHALL return a final result DTO for that match
- **And** the final result SHALL use the displayed score

#### Scenario: TE+P match is skipped

- **Given** the LPF page contains a match row with status `TE+P`
- **When** the provider lists final results
- **Then** it SHALL NOT return a final result DTO for that match
- **And** it SHALL avoid importing the penalty/advancement outcome as a normal score

#### Scenario: Unknown non-final status is skipped

- **Given** the LPF page contains a match row with a status other than `TC`
- **When** the provider lists final results
- **Then** it SHALL skip that row

### Requirement: Existing sync flow reuse

The LPF web provider MUST reuse the existing import and staged-result flow.

#### Scenario: Import tournament through sync service

- **Given** `SPORTS_DATA_PROVIDER=lpf-web`
- **And** the tournament slug is `liga-argentina-2026`
- **When** `importTournament()` is invoked for that tournament
- **Then** the sync service SHALL call the provider with the tournament slug
- **And** it SHALL upsert teams, venues, fixtures, and external references using existing sync logic

#### Scenario: Stage final results through sync service

- **Given** `SPORTS_DATA_PROVIDER=lpf-web`
- **And** the LPF provider returns TC final results
- **When** `syncResults()` is invoked
- **Then** results SHALL be staged for admin review using existing external match result logic
- **And** they SHALL NOT be applied directly without confirmation
