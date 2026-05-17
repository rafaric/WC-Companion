# Proposal: Phase 1 Locale Routing

## Intent

Add phase-1 i18n to the Next.js 15 web app so English and Rioplatense Spanish are available through locale-prefixed URLs, while keeping current authenticated and marketing flows usable without introducing a profile/onboarding language selector yet.

## Scope

### In Scope
- Configure `next-intl` for App Router with locales `en` and `es`, default `en`
- Add localized routing under `/en/...` and `/es/...`, including middleware coexistence with Auth0
- Preserve locale across navbar/app-shell navigation, landing, dashboard, and share flows
- Localize metadata and visible copy for app chrome, landing, dashboard, and share surfaces

### Out of Scope
- Onboarding/profile modal locale selector and profile-driven language persistence
- Admin surfaces, backend/API messages, validation/errors returned by services, and extra Spanish variants
- Non-phase-1 pages such as groups/rankings beyond navigation continuity

## Capabilities

### New Capabilities
- `localized-web-experience`: Locale-prefixed routing, dictionary loading, locale-aware metadata, and locale-preserving navigation for phase-1 web surfaces

### Modified Capabilities
- None

## Approach

Introduce a `[locale]` App Router segment backed by `next-intl` request config and message dictionaries. Merge locale routing into `apps/web/middleware.ts` without breaking Auth0 protection, move phase-1 pages and shell under localized routes, and replace hardcoded copy/links with locale-aware helpers so navigation and metadata stay on the current locale.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/package.json` | Modified | Add `next-intl` dependency |
| `apps/web/middleware.ts` | Modified | Compose locale routing with Auth0 middleware |
| `apps/web/app/` | Modified | Introduce localized route structure for layout and phase-1 pages |
| `apps/web/app/app-chrome.tsx` | Modified | Localize navbar labels and locale-preserving links |
| `apps/web/src/lib/metadata.ts` | Modified | Generate locale-aware canonical/open graph metadata |
| `apps/web/src/i18n/` | New | Routing, request config, and message dictionaries |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Auth redirects drop locale | Med | Centralize locale-aware login/logout and return paths |
| Broken links after route move | Med | Use shared localized navigation helpers and route coverage checks |
| Partial translation gaps | Med | Limit phase 1 surfaces and keep untranslated areas explicitly out of scope |

## Rollback Plan

Remove `next-intl`, restore non-localized routes/layout, and revert middleware/metadata changes so the app returns to the current English-only structure.

## Dependencies

- `next-intl` compatible with Next.js 15 App Router

## Success Criteria

- [ ] `/en/...` and `/es/...` render phase-1 surfaces with the correct dictionary and English default fallback
- [ ] Navbar and primary calls-to-action keep users on the active locale during navigation and auth round-trips
- [ ] Landing, dashboard, share, and their metadata are localized; onboarding/profile locale selector remains deferred as follow-up
