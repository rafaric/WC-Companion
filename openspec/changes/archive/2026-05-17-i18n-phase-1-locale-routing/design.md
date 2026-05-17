# Design: Phase 1 Locale Routing

## Technical Approach

Adopt `next-intl` as the App Router i18n layer and enforce a top-level `app/[locale]` segment for all web routes that should participate in locale-aware navigation. `en` remains the default locale, but URLs are always explicit (`/en/...`, `/es/...`). Phase 1 localizes the app chrome plus landing, dashboard, share, and onboarding; groups/rankings/admin move under the locale segment only to preserve URL continuity and auth round-trips, while their copy can stay English for now.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|---|---|---|---|
| Route shape | Cookie-only locale, optional prefix, required prefix | Required prefix touches more files, but removes ambiguity and matches confirmed decisions | Use `app/[locale]` with `generateStaticParams`, `hasLocale`, and `setRequestLocale` |
| Dictionary ownership | Per-page inline objects, shared JSON dictionaries, CMS | JSON adds files but keeps reviewable diffs and no backend dependency | Store `en` and `es` messages in `apps/web/src/i18n/messages/*.json` by namespace (`common`, `landing`, `dashboard`, `share`, `onboarding`, `metadata`) |
| Navigation/auth helpers | Raw `next/link` + string redirects, custom wrappers, middleware-only fixes | Raw strings will keep dropping locale in links and `returnTo` params | Create shared locale-aware `Link`, `redirect`, pathname, and auth URL builders from `next-intl/navigation` |
| Middleware composition | Auth0 only, next-intl only, composed middleware | Composition must preserve rolling sessions and avoid prefixing `/auth/*` | Root middleware runs next-intl for app routes, skips `/auth/*`, then lets Auth0 middleware continue handling session plumbing |

## Data Flow

```text
Request /dashboard
  -> middleware detects missing locale
  -> redirect to /en/dashboard
  -> app/[locale]/layout validates locale + setRequestLocale(locale)
  -> next-intl request config loads messages
  -> page/layout render locale-aware metadata, copy, and links
  -> unauthenticated action uses auth helper
  -> /auth/login?returnTo=/en/dashboard
```

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/web/next.config.ts` | Modify | Wrap config with `next-intl/plugin` |
| `apps/web/middleware.ts` | Modify | Compose locale routing with existing Auth0 middleware; exclude `/auth`, static assets, and API-like paths |
| `apps/web/src/i18n/routing.ts` | Create | Define locales, default locale, and locale prefix policy |
| `apps/web/src/i18n/navigation.ts` | Create | Export locale-aware `Link`, `redirect`, `useRouter`, and pathname helpers |
| `apps/web/src/i18n/request.ts` | Create | Load per-locale messages for Server Components |
| `apps/web/src/i18n/messages/en.json` | Create | English namespaces |
| `apps/web/src/i18n/messages/es.json` | Create | Rioplatense Spanish namespaces |
| `apps/web/src/lib/locale-routing.ts` | Create | Helpers for localized hrefs, `returnTo`, and scoped-path migration |
| `apps/web/src/lib/metadata.ts` | Modify | Build localized metadata, canonical URLs, alternates, and OG locale mapping |
| `apps/web/app/layout.tsx` | Modify | Reduce root layout to global HTML/body and CSS only |
| `apps/web/app/[locale]/layout.tsx` | Create | New locale-aware shell, session/profile fetch, `AppChrome`, and localized metadata |
| `apps/web/app/[locale]/page.tsx` | Create | Localized landing page |
| `apps/web/app/[locale]/{dashboard,share,onboarding}/page.tsx` | Create | Localized phase-1 surfaces |
| `apps/web/app/[locale]/{groups,groups/[groupId],rankings,admin/external-results}/page.tsx` | Create | Locale-wrapped continuity routes; content can stay English in phase 1 |
| `apps/web/app/app-chrome.tsx` | Modify | Replace `next/link` and hardcoded labels with locale-aware helpers/messages |
| `apps/web/app/actions/update-profile.ts` | Modify | Revalidate and redirect using localized paths |
| `apps/web/app/{robots.ts,sitemap.ts}` | Modify | Emit localized URLs/disallow rules |

## Interfaces / Contracts

```ts
export const LOCALES = { EN: "en", ES: "es" } as const;
export type AppLocale = (typeof LOCALES)[keyof typeof LOCALES];

export function buildLocalizedPath(locale: AppLocale, path: `/${string}`): string;
export function buildAuthHref(input: { locale: AppLocale; screen: "/dashboard" | "/share" | "/onboarding" | "/groups" | "/admin/external-results"; }): string;
```

Message namespaces stay flat and route-scoped, e.g. `common.nav.dashboard`, `landing.hero.title`, `metadata.dashboard.title`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Static checks | Routing/types/messages | `pnpm web:typecheck` and `pnpm web:lint` |
| Integration | Middleware redirects, locale loading, auth `returnTo`, metadata alternates | Add focused tests only if lightweight frontend harness is introduced in the same work unit; otherwise verify manually in dev |
| Manual smoke | `/en` and `/es` landing, dashboard, share, onboarding, login/logout round-trips, navbar links | Browser verification against both locales |

## Migration / Rollout

1. Add i18n infrastructure (`next-intl`, routing, messages, metadata helpers).
2. Introduce `app/[locale]` and move scoped surfaces first.
3. Add locale wrappers for groups/rankings/admin so existing flows stop dropping locale without promising full translation.
4. Redirect bare scoped URLs to `/en/...`; do not add selector persistence yet.
5. Follow-up: wire onboarding/profile selector to update `preferredLanguage`, then choose locale from explicit user action while keeping URL as the source of truth for the current request.

## Open Questions

- [ ] None blocking; phase 1 can proceed with English-only continuity on non-scoped pages.
