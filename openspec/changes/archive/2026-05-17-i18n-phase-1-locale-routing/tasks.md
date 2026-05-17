# Tasks: Phase 1 Locale Routing — i18n with next-intl

## Phase 1: Infrastructure & Foundation

- [x] 1.1 Install `next-intl` in `apps/web/package.json` and verify compatibility with Next.js 15 App Router
- [x] 1.2 Create `apps/web/src/i18n/routing.ts` with `routing` config: locales `['en', 'es']`, default locale `'en'`, `localePrefix: 'as-needed'`
- [x] 1.3 Create `apps/web/src/i18n/request.ts` with `getRequestConfig` that resolves locale from `routing` and loads messages from `messages/{locale}.json`
- [x] 1.4 Create `apps/web/src/i18n/messages/en.json` with empty root object (phase-1 keys added incrementally per surface)
- [x] 1.5 Create `apps/web/src/i18n/messages/es.json` with Rioplatense Spanish translations matching the `en.json` key structure
- [x] 1.6 Update `apps/web/next.config.ts` to wrap config with `createNextIntlPlugin()` from `next-intl/plugin`
- [x] 1.7 Create `apps/web/src/lib/locale-nav.ts` with shared helpers: `getLocalizedPath(locale, path)`, `stripLocalePrefix(pathname)`, `getLocaleFromPathname(pathname)` — these are reused by every surface for redirects, links, and `revalidatePath`

## Phase 2: Route & Layout Migration

- [ ] 2.1 Restructure `apps/web/app/` to `apps/web/app/[locale]/` — move all route directories (`page.tsx`, `dashboard/`, `share/`, `onboarding/`, `groups/`, `rankings/`, `admin/`, `app-chrome.tsx`, `profile-edit-modal.tsx`, `actions/`, `providers.tsx`) under the `[locale]` segment. Keep static files (`globals.css`, `favicon`, `manifest.ts`, `robots.ts`, `sitemap.ts`) at the root level
- [x] 2.2 Update `apps/web/app/[locale]/layout.tsx` to accept `params: Promise<{ locale: string }>`, validate locale against `routing.locales`, set `html lang={locale}`, and wrap children with `NextIntlClientProvider` from `next-intl`
- [x] 2.3 Update `apps/web/middleware.ts` to compose `auth0.middleware` with `createSharedPathnamesNavigation` or `next-intl` middleware — Auth0 routes (`/auth/*`) and API routes (`/api/*`) must be excluded from locale handling via `matcher` config
- [ ] 2.4 Verify `/` redirects to `/en/` (default locale) and `/es/` loads the Spanish dictionary — test manually with `next dev`

## Phase 3: Core Implementation — String Extraction & Locale-Aware Metadata

- [ ] 3.1 Extract all hardcoded strings from `apps/web/app/[locale]/app-chrome.tsx` into message keys under namespace `chrome.*` (nav labels "Dashboard", "Groups", "Share cards", "Rankings", "External results", "Log out", "Menu", section labels, accessibility labels). Replace `next/link` with `next-intl` `Link` for locale-aware hrefs
- [ ] 3.2 Extract all hardcoded strings from `apps/web/app/[locale]/page.tsx` (landing) into message keys under namespace `landing.*` — hero copy, CTA labels, step titles/descriptions, value pillar titles/descriptions, reassurance labels, account section copy, structured data `inLanguage` field
- [ ] 3.3 Extract all hardcoded strings from `apps/web/app/[locale]/dashboard/page.tsx` into message keys under namespace `dashboard.*` — page title, error messages (`ERROR_MESSAGES` dict), section headers, CTA labels, status labels, match outcome labels
- [ ] 3.4 Extract all hardcoded strings from `apps/web/app/[locale]/share/page.tsx` into message keys under namespace `share.*` — page title, share template labels, success/error messages, section headers
- [ ] 3.5 Extract all hardcoded strings from `apps/web/app/[locale]/onboarding/page.tsx` into message keys under namespace `onboarding.*` — form labels, error messages (`ERROR_MESSAGES` dict), page title, CTA labels
- [ ] 3.6 Extract all hardcoded strings from `apps/web/app/[locale]/groups/page.tsx` and `apps/web/app/[locale]/groups/[groupId]/page.tsx` into message keys under namespace `groups.*` — page titles, action tab labels, error/success messages, copy invite button text
- [ ] 3.7 Extract all hardcoded strings from `apps/web/app/[locale]/rankings/page.tsx` into message keys under namespace `rankings.*` — page title, ranking labels, column headers
- [ ] 3.8 Extract all hardcoded strings from `apps/web/app/[locale]/profile-edit-modal.tsx` into message keys under namespace `profile.*` — modal labels, form copy, validation messages
- [ ] 3.9 Update `apps/web/src/lib/metadata.ts` — `buildPageMetadata` must accept an optional `locale` parameter, set `openGraph.locale` dynamically (e.g., `en_US` / `es_AR`), and add `alternates.languages` with hreflang entries for both locales
- [ ] 3.10 Replace all hardcoded `Intl.DateTimeFormat("en", ...)` calls across pages with the active locale parameter passed from each page's `params`

## Phase 4: Navigation & Redirect Wiring

- [ ] 4.1 Update `apps/web/app/[locale]/actions/update-profile.ts` — replace `redirect("/onboarding?error=...")` and `redirect(redirectTo)` with locale-aware paths using `getLocalizedPath(locale, path)`. Update `revalidatePath("/")`, `revalidatePath("/dashboard")`, `revalidatePath("/onboarding")` to use locale-prefixed paths or catch-all patterns
- [ ] 4.2 Update `apps/web/app/[locale]/dashboard/page.tsx` — replace all `redirect("/dashboard?error=...")` calls with locale-aware redirects. Update `revalidatePath("/dashboard")` calls
- [ ] 4.3 Update `apps/web/app/[locale]/share/page.tsx` — replace all `redirect("/share?...")` calls with locale-aware redirects. Update `revalidatePath("/share")` calls
- [ ] 4.4 Update `apps/web/app/[locale]/onboarding/page.tsx` — replace `redirect("/auth/login?returnTo=/onboarding")` with locale-aware returnTo. Replace `redirect("/dashboard")` with locale-aware path
- [ ] 4.5 Update all `Link` components across phase-1 pages to use `next-intl` `Link` (imported from `next-intl`) so hrefs are automatically locale-prefixed. This includes landing CTAs, dashboard nav, share links, onboarding links, and groups links
- [ ] 4.6 Fix `usePathname()` active-state logic in `apps/web/app/[locale]/app-chrome.tsx` — strip locale prefix before comparing against `navItems.href`, or compare against locale-aware hrefs. Update `isAuthenticatedPath` to account for `/[locale]/dashboard` pattern
- [x] 4.7 Update Auth0 `returnTo` URLs — the login link `/auth/login?returnTo=/dashboard` on the landing page must include the current locale prefix so users return to the correct language after authentication

## Phase 5: SEO, Verification & Cleanup

- [x] 5.1 Update `apps/web/app/sitemap.ts` to generate locale-variant entries for both `/en/` and `/es/` (and their sub-routes) with `alternates.languages` hreflang tags
- [x] 5.2 Update `apps/web/app/robots.ts` to include locale-prefixed disallow paths (e.g., `/en/admin`, `/es/admin`, etc.) or use a pattern that covers both locales
- [ ] 5.3 Run `pnpm --filter web typecheck` (or equivalent) and fix any TypeScript errors from the route restructuring
- [ ] 5.4 Run `pnpm --filter web build` and verify no build errors. Confirm `/en/` and `/es/` render correctly with their respective dictionaries
- [ ] 5.5 Manual verification checklist:
  - `/` redirects to `/en/`
  - `/es/` loads Spanish dictionary with Rioplatense copy
  - Navbar navigation preserves locale across all phase-1 pages
  - Auth0 login/logout round-trips preserve locale in `returnTo`
  - Dashboard prediction save/redirect cycle works on both locales
  - Share page redirects and revalidation work on both locales
  - Metadata `openGraph.locale` and `alternates.languages` are correct per locale
  - Sitemap includes both locale variants

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| **Estimated changed lines** | ~600–800 lines (large due to file moves under `[locale]/` and string extraction across 7+ surfaces) |
| **400-line budget risk** | **EXCEEDED** — this change is inherently large because it restructures the entire `app/` directory and extracts strings from every phase-1 surface |
| **Chained PRs recommended** | **YES** — split into at least 2 PRs: (A) Infrastructure + route migration (Phase 1–2), (B) String extraction + navigation wiring (Phase 3–5) |
| **Decision needed before apply** | No — all decisions confirmed in proposal/exploration. The Rioplatense `es` dictionary content is the only creative judgment, and it follows the confirmed convention |

### Recommended PR Split

**PR A: Infrastructure + Route Migration** (~300 lines)
- Tasks 1.1–1.7, 2.1–2.4
- Adds `next-intl`, creates i18n config, moves routes under `[locale]`, composes middleware
- Risk: Auth0 middleware composition — must be tested before merging

**PR B: String Extraction + Navigation Wiring** (~300–500 lines)
- Tasks 3.1–3.10, 4.1–4.7, 5.1–5.5
- Extracts all strings, updates redirects/links, fixes SEO, verifies end-to-end
- Risk: Translation completeness — untranslated keys will fall back to English (acceptable for phase 1)
