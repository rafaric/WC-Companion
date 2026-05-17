# Localized Web Experience Specification

## Purpose

Define phase-1 internationalized web behavior so the Next.js app serves English and Rioplatense Spanish through locale-prefixed routes, keeps users on the active locale during navigation and redirects, localizes selected surfaces and metadata, and defers profile-driven locale selection to a follow-up change.

## Requirements

### Requirement: Locale-prefixed phase-1 routes

The system MUST expose the phase-1 web experience through locale-prefixed routes for `en` and `es` so supported surfaces render under `/en/...` and `/es/...` instead of locale-neutral URLs.

#### Scenario: English route renders the English experience

- GIVEN a user requests a phase-1 surface under `/en/...`
- WHEN the system renders that route
- THEN the system SHALL resolve the active locale as `en`
- AND the system SHALL render that surface with English content and document language metadata for English

#### Scenario: Spanish route renders the Rioplatense Spanish experience

- GIVEN a user requests a phase-1 surface under `/es/...`
- WHEN the system renders that route
- THEN the system SHALL resolve the active locale as `es`
- AND the system SHALL render that surface with Rioplatense Spanish content and document language metadata for Spanish

### Requirement: Default locale and fallback behavior

The system MUST treat `en` as the default locale for phase-1 routing and content fallback behavior.

#### Scenario: Root entry redirects to the default locale

- GIVEN a user requests the web root without a locale prefix
- WHEN the system resolves the request
- THEN the system SHALL redirect the user to the equivalent `en` route

#### Scenario: Missing localized content falls back to English

- GIVEN a phase-1 surface is rendered for locale `es`
- AND a required localized message for that surface is unavailable in Spanish
- WHEN the system prepares the response
- THEN the system SHALL continue rendering the page
- AND the system SHALL use the English version of the missing message instead of failing the request

### Requirement: Locale-preserving navigation and redirects

The system MUST preserve the active locale across user navigation and route transitions for phase-1 and continuity surfaces, including authenticated redirects.

#### Scenario: App navigation keeps the active locale

- GIVEN an authenticated user is browsing a shell-backed surface under `/es/...`
- WHEN the user follows primary navigation to another shell-backed surface
- THEN the destination URL SHALL remain under `/es/...`
- AND the destination surface SHALL render in Spanish

#### Scenario: Auth redirect keeps the requested locale

- GIVEN an unauthenticated user requests a protected phase-1 surface under `/es/...`
- WHEN the system redirects the user through authentication and returns them to the app
- THEN the return destination SHALL remain the originally requested `/es/...` surface

#### Scenario: Profile-completion redirect keeps the active locale

- GIVEN an authenticated user on a locale-prefixed protected surface has not completed the required profile fields
- WHEN the system redirects that user to continue onboarding
- THEN the redirect target SHALL preserve the active locale prefix

### Requirement: Localized phase-1 visible content

The system MUST localize user-visible copy for the phase-1 surfaces in scope: app chrome, landing, dashboard, and share.

#### Scenario: Landing page content is localized

- GIVEN a user opens the landing page under `/es/`
- WHEN the page is rendered
- THEN the hero copy, calls to action, reassurance labels, and informational sections SHALL be shown in Rioplatense Spanish

#### Scenario: Dashboard content is localized

- GIVEN a user opens the dashboard under `/es/dashboard`
- WHEN the page is rendered
- THEN dashboard headings, helper text, alerts, ranking copy, and prediction workflow labels SHALL be shown in Rioplatense Spanish

#### Scenario: Share experience content is localized

- GIVEN a user opens the share experience under `/es/share`
- WHEN the page is rendered
- THEN share form labels, preview labels, success messages, and error messages SHALL be shown in Rioplatense Spanish

#### Scenario: App chrome content is localized

- GIVEN an authenticated user opens a shell-backed surface under `/es/...`
- WHEN the application chrome is rendered
- THEN navigation labels, section labels, menu controls, and logout affordances SHALL be shown in Rioplatense Spanish

### Requirement: Locale-aware metadata for phase-1 surfaces

The system MUST localize metadata for phase-1 surfaces so locale-prefixed routes publish locale-correct titles, descriptions, and discovery metadata.

#### Scenario: Localized route emits locale-correct page metadata

- GIVEN a user requests `/es/share`
- WHEN the system generates metadata for that page
- THEN the canonical URL SHALL reference the `/es/share` route
- AND the locale-specific metadata fields SHALL identify Spanish content for that route
- AND the title and description SHALL be localized in Spanish

#### Scenario: Discovery metadata includes both supported locales

- GIVEN the system generates discovery metadata for the phase-1 web experience
- WHEN sitemap or equivalent route discovery output is requested
- THEN the output SHALL include entries for both `en` and `es` variants of phase-1 routes

## Non-Goals

The following items are explicitly out of scope for phase 1 and MUST NOT be required for this change to be considered complete:

- A locale selector in onboarding, profile editing, or other account management UI
- Persisting locale choice from profile preferences as the source of route selection
- Localizing surfaces outside the explicit phase-1 set of app chrome, landing, dashboard, share, and their metadata
- Supporting additional locales or Spanish variants beyond `en` and Rioplatense `es`
