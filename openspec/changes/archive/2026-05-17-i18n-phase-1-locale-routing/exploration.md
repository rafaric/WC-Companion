## Exploration: i18n Phase 1 — Locale-in-URL Routing

### Current State

The project is a Next.js 15 App Router application (`apps/web`) with React 19 and Tailwind CSS 4. There is **no existing i18n infrastructure**:

- All UI strings are hardcoded in English across pages and components.
- `metadata.ts` hardcodes `locale: "en_US"` and English-only titles/descriptions.
- `Intl.DateTimeFormat("en", ...)` is used in `page.tsx`, `dashboard/page.tsx`, `share/page.tsx`, `match-prediction-accordion.tsx`, and `groups/page.tsx`.
- Routing is flat under `app/` with no locale segment.
- `middleware.ts` only runs Auth0 middleware (`@auth0/nextjs-auth0`).
- The user profile model already stores `preferredLanguage` (`es` | `en`), and `PROFILE_LANGUAGE_OPTIONS` exists in `src/lib/profile.ts`, but this field is **not used for routing or UI localization** today.
- Auth0 login/logout redirects use hardcoded paths (e.g., `/auth/login?returnTo=/dashboard`).
- Server actions use `redirect("/dashboard")` and `revalidatePath("/dashboard")` with hardcoded paths.

### Affected Areas

| File | Why it's affected |
|------|-------------------|
| `app/layout.tsx` | Root layout must accept `[locale]` param, set `html lang`, and inject `next-intl` provider. Metadata must become locale-aware. |
| `app/page.tsx` | Landing page has extensive hardcoded English copy, CTAs, structured data, and `Intl.DateTimeFormat`. |
| `app/app-chrome.tsx` | Nav labels ("Dashboard", "Groups", "Share cards", etc.) and mobile menu strings need translation. `usePathname()` logic needs updating for locale-prefixed paths. |
| `app/dashboard/page.tsx` | Heavy UI text, error messages, `redirect`/`revalidatePath` calls, metadata, and `Intl.DateTimeFormat`. |
| `app/share/page.tsx` | Share card templates, section headers, success/error messages, metadata, and `Intl.DateTimeFormat`. |
| `app/onboarding/page.tsx` | Form labels, error messages, metadata, and redirects. |
| `app/groups/page.tsx` | Group cards, action tabs, error/success messages, metadata, and `Intl.DateTimeFormat`. |
| `app/rankings/page.tsx` | Ranking labels, metadata. |
| `app/profile-edit-modal.tsx` | Modal labels, form copy, and validation messages (client component). |
| `app/actions/update-profile.ts` | Error messages and `revalidatePath`/`redirect` paths. |
| `app/sitemap.ts` | Must generate locale-variant entries (`/en/`, `/es/`). |
| `app/robots.ts` | Disallow paths must account for locale prefixes. |
| `app/manifest.ts` | `start_url` and `name`/`description` may need locale awareness. |
| `src/lib/metadata.ts` | `buildPageMetadata` and `SITE_DESCRIPTION` need to support locale. |
| `middleware.ts` | Must compose Auth0 middleware with `next-intl` locale routing. Auth0 routes must be excluded from locale handling. |
| `next.config.ts` | Must add `next-intl` plugin for locale config and path aliases. |

### Approaches

#### 1. **next-intl with App Router (Recommended)**

Use the `next-intl` library, which is the standard i18n solution for Next.js App Router.

- **How it works:** Define `i18n/routing.ts` with locales (`en`, `es`) and default locale (`en`). Wrap the app in a `[locale]` dynamic segment. Use `getTranslations` in server components and `useTranslations` in client components. The `next-intl` middleware handles locale prefixing and redirects (`/` → `/en/`).

- **Pros:**
  - Purpose-built for Next.js 15 App Router; handles routing, metadata, and links.
  - Strong TypeScript support with type-safe message keys.
  - Active maintenance and large community.
  - Minimal boilerplate once set up.

- **Cons:**
  - Requires moving all routes under `app/[locale]/`.
  - Middleware composition with Auth0 needs careful matcher configuration.
  - All hardcoded strings must be extracted to message files.

- **Effort:** Medium

#### 2. **Custom i18n implementation**

Build a custom message loader, context provider, and middleware for locale routing.

- **Pros:** Full control over behavior.

- **Cons:** High maintenance burden; must re-implement routing, link prefixing, metadata handling, and server/client hydration. Error-prone and not recommended for App Router.

- **Effort:** High

### Recommendation

Use **next-intl (Approach 1)**. It is the de-facto standard for App Router i18n, and the project's Next.js 15 + React 19 stack is fully supported. The primary work is mechanical: extracting strings, moving files into `[locale]`, and updating middleware.

### Route / Layout Implications

1. **File structure change:** All routes move from `app/<route>/` to `app/[locale]/<route>/`.
2. **Root layout:** `app/layout.tsx` becomes `app/[locale]/layout.tsx` and receives `params: { locale }`.
3. **Auth0 routes:** `/auth/login`, `/auth/logout`, `/auth/callback` (handled by `@auth0/nextjs-auth0`) must remain **outside** the `[locale]` segment or be explicitly excluded in the `next-intl` middleware config. The simplest approach is to keep them at the root and exclude them from locale middleware via matcher.
4. **API routes:** `app/api/` should also be excluded from locale middleware.
5. **Default locale redirect:** `next-intl` middleware can automatically redirect `/` → `/en/` (default locale). This is the desired behavior.
6. **Metadata:** `buildPageMetadata` must accept a locale and switch `openGraph.locale` and `alternates` accordingly.
7. **Sitemap:** Should emit entries for both `/en/` and `/es/` (and their sub-routes) with `hreflang` alternates.

### Migration Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Middleware composition** | High | Auth0 middleware and `next-intl` middleware must be composed carefully. Auth0 routes (`/auth/*`) and API routes (`/api/*`) must be excluded from `next-intl` locale handling via matcher config. Test login/logout flows end-to-end. |
| **Hardcoded redirects** | High | Every `redirect("/dashboard")`, `redirect("/auth/login?returnTo=/dashboard")`, and `redirect("/onboarding?error=...")` in server components and server actions must be updated to include the locale prefix (e.g., `/${locale}/dashboard`). Consider a helper like `getLocalizedPath(locale, path)`. |
| **`revalidatePath` calls** | Medium | `revalidatePath("/dashboard")` may need locale-prefixed paths (`/en/dashboard`, `/es/dashboard`) or a catch-all pattern. Verify Next.js caching behavior with dynamic `[locale]` segments. |
| **Link components** | Medium | Next.js `Link` from `next/link` does not auto-prefix locale. Use `next-intl`'s `Link` component, or ensure all `href` values are locale-aware. A helper or wrapper component is recommended. |
| **`usePathname()` in `app-chrome.tsx`** | Medium | `usePathname()` will now return `/en/dashboard` instead of `/dashboard`. Active-state logic (`pathname === item.href`, `pathname.startsWith(...)`) must be updated to strip the locale prefix before comparison, or compare against locale-aware `href` values. |
| **Auth0 `returnTo` URLs** | High | The `returnTo` query parameter in `/auth/login?returnTo=/dashboard` must include the locale prefix so users return to the correct language after authentication. |
| **Server/client boundary** | Medium | `next-intl` requires async `getTranslations` in server components and `useTranslations` in client components. Ensure client components that need strings are properly wrapped or receive translated strings as props from server parents. |
| **Tournament selector** | Low | The tournament selector uses cookies and is independent of locale. No direct risk, but verify it continues to work after middleware changes. |
| **`Intl.DateTimeFormat`** | Low | Replace hardcoded `"en"` locale with the active locale parameter in all formatting calls. |
| **SEO / Structured data** | Medium | Landing page structured data (`LANDING_STRUCTURED_DATA`) hardcodes `"inLanguage": "en"`. Update dynamically. Sitemap and robots.txt must reflect locale prefixes. |
| **Build failure** | Medium | Moving files to `[locale]` may break imports or TypeScript path aliases. Run `typecheck` after restructuring. |

### Ready for Proposal

**Yes.** The integration path is clear:

1. Install `next-intl`.
2. Create `i18n/routing.ts`, `i18n/request.ts`, and message files (`messages/en.json`, `messages/es.json`).
3. Restructure `app/` to `app/[locale]/`.
4. Compose middleware (Auth0 + `next-intl`).
5. Update `next.config.ts` with `next-intl` plugin.
6. Extract strings for the five phase-1 surfaces (landing, dashboard, share, onboarding, groups, rankings, app chrome, metadata).
7. Update all hardcoded redirects, links, and `revalidatePath` calls to be locale-aware.

**What the orchestrator should tell the user:**
- Phase 1 will restructure the `app/` directory by adding a `[locale]` segment. This is a significant file move but low risk because it is mechanical.
- Auth0 login/logout flows will be tested explicitly to ensure middleware composition does not break authentication.
- The `es` dictionary will be written in **Rioplatense Spanish** (e.g., "Predicciones", "Grupos", "Competí").
- Locale selector UI is explicitly **out of scope** for phase 1 and will be handled as a follow-up in onboarding/profile modal.
