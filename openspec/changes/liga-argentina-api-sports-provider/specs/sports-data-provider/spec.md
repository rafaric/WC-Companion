# Sports Data Provider Specification

## Purpose

Define provider-selection and api-sports ingestion behavior for provider-backed sports data sync without changing existing football-data or mock integrations.

## Requirements

### Requirement: Configured sports data provider selection

The system MUST select the sports data provider from deployment configuration.

#### Scenario: api-sports provider is selected

- GIVEN the deployment config sets `SPORTS_DATA_PROVIDER=api-sports`
- WHEN the sports-data module resolves its provider implementation
- THEN the system MUST instantiate the api-sports provider
- AND the provider MUST be used for provider-backed sports data reads

#### Scenario: existing providers remain selectable

- GIVEN the deployment config sets `SPORTS_DATA_PROVIDER=football-data` or `SPORTS_DATA_PROVIDER=mock`
- WHEN the sports-data module resolves its provider implementation
- THEN the system MUST preserve the existing provider behavior for that configured value

### Requirement: api-sports environment contract

The api-sports provider MUST read its credentials from environment configuration.

#### Scenario: default api-sports endpoint is used

- GIVEN `SPORTS_DATA_PROVIDER=api-sports`
- AND `API_SPORTS_API_KEY` is configured
- AND no api-sports base URL override is configured
- WHEN the provider creates outbound requests
- THEN the system MUST authenticate with `API_SPORTS_API_KEY`
- AND the system MUST target the default api-sports football API base URL

#### Scenario: base URL override is honored

- GIVEN `SPORTS_DATA_PROVIDER=api-sports`
- AND `API_SPORTS_API_KEY` is configured
- AND `API_SPORTS_BASE_URL` is configured
- WHEN the provider creates outbound requests
- THEN the system MUST target the configured override URL instead of the default base URL

### Requirement: Liga Argentina tournament gating

The system MUST allow provider-backed sync for the approved Liga Argentina tournament slug.

#### Scenario: Liga Argentina sync is allowed

- GIVEN a provider-backed sync request for tournament slug `liga-argentina-2026`
- WHEN the sync service evaluates whether provider sync is supported
- THEN the system MUST treat that tournament slug as supported

#### Scenario: unrelated tournament gating is unchanged

- GIVEN a provider-backed sync request for a tournament slug that is not already supported and is not `liga-argentina-2026`
- WHEN the sync service evaluates whether provider sync is supported
- THEN the system MUST preserve the existing unsupported-tournament behavior

### Requirement: api-sports tournament configuration

The api-sports provider MUST resolve Liga Argentina requests through tournament slug configuration.

#### Scenario: Liga Argentina provider metadata is resolved

- GIVEN a sports-data request for tournament slug `liga-argentina-2026`
- WHEN the api-sports provider resolves provider-specific tournament metadata
- THEN the system MUST use the configured Liga Argentina league identifier
- AND the system MUST use the configured target season value for that slug

### Requirement: Team DTO mapping from api-sports

The api-sports provider MUST map provider team payloads into shared sports-data team DTOs.

#### Scenario: team identities are mapped

- GIVEN an api-sports team payload for the configured tournament
- WHEN the provider returns team DTOs
- THEN each DTO MUST include the provider team identifier as its stable source identifier
- AND each DTO MUST include the team display name
- AND each DTO MUST preserve provider-backed team branding fields that exist in the shared DTO contract

#### Scenario: missing abbreviation data is tolerated

- GIVEN an api-sports team payload without a complete abbreviation or short-code field
- WHEN the provider maps that team into the shared DTO
- THEN the system MUST still emit a valid team DTO
- AND the mapping MUST use the provider's available fallback naming fields instead of dropping the team

### Requirement: Venue DTO mapping from api-sports

The api-sports provider MUST map fixture venue payloads into shared sports-data venue DTOs.

#### Scenario: venue data is emitted from fixture payloads

- GIVEN api-sports fixture payloads that include venue information
- WHEN the provider returns venue DTOs
- THEN the system MUST emit venue DTOs derived from provider venue identifiers and names
- AND the system MUST preserve available venue location fields supported by the shared DTO contract

#### Scenario: repeated venues are normalized

- GIVEN multiple api-sports fixtures that reference the same venue
- WHEN the provider returns venue DTOs
- THEN the system SHOULD avoid emitting duplicate venue entries for the same provider venue identifier

### Requirement: Fixture DTO mapping from api-sports

The api-sports provider MUST map api-sports fixtures into shared sports-data fixture DTOs.

#### Scenario: fixture participants and scheduling are mapped

- GIVEN an api-sports fixture payload for the configured tournament
- WHEN the provider returns fixture DTOs
- THEN each fixture DTO MUST include the provider fixture identifier as its stable source identifier
- AND each fixture DTO MUST include home-team and away-team source identifiers
- AND each fixture DTO MUST include the scheduled kickoff timestamp
- AND each fixture DTO MUST preserve available round or stage labeling supported by the shared DTO contract

### Requirement: Final result DTO mapping and FT filtering

The api-sports provider MUST derive final results only from full-time fixtures.

#### Scenario: full-time fixtures become final results

- GIVEN an api-sports fixture payload with `fixture.status.short` equal to `FT`
- WHEN the provider returns final result DTOs
- THEN the fixture MUST be included as a final result
- AND the DTO MUST include the provider fixture identifier
- AND the DTO MUST include the mapped home and away scores from the provider payload

#### Scenario: non-final fixtures are excluded

- GIVEN an api-sports fixture payload with `fixture.status.short` not equal to `FT`
- WHEN the provider returns final result DTOs
- THEN the fixture MUST NOT be included in the final result set

### Requirement: Non-regression for existing providers

Adding api-sports support MUST NOT change the existing behavior of football-data or mock providers.

#### Scenario: football-data behavior is preserved

- GIVEN a deployment configured for `SPORTS_DATA_PROVIDER=football-data`
- WHEN sports-data reads and sync flows execute
- THEN the system MUST preserve the existing football-data provider contract and behavior

#### Scenario: mock behavior is preserved

- GIVEN a deployment configured for `SPORTS_DATA_PROVIDER=mock` or an equivalent fallback path
- WHEN sports-data reads and sync flows execute
- THEN the system MUST preserve the existing mock provider contract and behavior
