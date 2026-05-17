## Verification Report

**Change**: i18n-phase-1-locale-routing  
**Mode**: hybrid (read from OpenSpec + Engram, wrote OpenSpec artifact)  
**Strict TDD**: Not active — no explicit strict-TDD evidence found, and `openspec/config.yaml` still says frontend test setup is not detected.

---

### Completeness

| Metric | Value |
|---|---:|
| Tasks total | 33 |
| Tasks checked complete | 7 |
| Tasks unchecked | 26 |

**Task-tracking assessment**

- The task checklist is materially stale versus the branch contents: code exists for many unchecked routing/localization tasks, but the artifact itself still marks most core work incomplete.
- Because SDD verification must judge the artifact state too, this is a **CRITICAL completeness gap** for archive-readiness.

Unchecked core areas still shown in `tasks.md`:

- Phase 2 route/layout migration tasks `2.1`–`2.4`
- Phase 3 localization/metadata tasks `3.1`–`3.10`
- Phase 4 navigation/redirect wiring tasks `4.1`–`4.7`
- Phase 5 verification/SEO/manual verification tasks `5.1`–`5.5`

---

### Build, Typecheck, Lint, and Runtime Evidence

**Commands run**

- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm web:lint`
- Runtime HTTP probes against a temporary local server on port `3100`

| Check | Result | Evidence |
|---|---|---|
| Typecheck (first clean run) | ❌ Failed | `TS6053: .next/types/validator.ts not found` because `apps/web/tsconfig.json` includes `.next/types/**/*.ts` before build artifacts exist |
| Build | ✅ Passed | `pnpm web:build` completed successfully on Next.js 15.5.18 |
| Typecheck (after build) | ✅ Passed | Re-running `pnpm web:typecheck` after build succeeded |
| Lint | ✅ Passed with warnings | No blocking lint errors; several unused imports/variables remain |
| Frontend automated tests | ➖ Not available | No web test files or frontend test runner found |

**Important runtime observations**

- `GET /` → `307` redirect to `/en` ✅
- `GET /es/dashboard` → `307` redirect to `/auth/login?returnTo=/es/dashboard` ✅ locale preserved
- `GET /es/share` → `307` redirect to `/auth/login?returnTo=/es/share` ✅ locale preserved
- `GET /es/onboarding` → `307` redirect to `/auth/login?returnTo=/es/onboarding` ✅ locale preserved
- `GET /es` → `307` redirect to `/auth/login?returnTo=/en/dashboard` ❌ requested locale lost and landing page not rendered for unauthenticated users

---

### Spec Compliance Matrix

No frontend automated tests exist in this branch. Per verification rules, scenarios cannot be marked compliant without a passing covering test. Manual/runtime notes are included where available, but all scenarios remain **UNTESTED** from an SDD compliance standpoint.

| Requirement | Scenario | Test | Result | Notes |
|---|---|---|---|---|
| Locale-prefixed phase-1 routes | English route renders the English experience | none found | ❌ UNTESTED | `/en` runtime path exists, but no automated proof |
| Locale-prefixed phase-1 routes | Spanish route renders the Rioplatense Spanish experience | none found | ❌ UNTESTED | `/es` currently redirects unauthenticated users to `/auth/login?returnTo=/en/dashboard` |
| Default locale and fallback behavior | Root entry redirects to the default locale | none found | ❌ UNTESTED | Manual runtime probe observed `/` → `/en` |
| Default locale and fallback behavior | Missing localized content falls back to English | none found | ❌ UNTESTED | `request.ts` loads one locale file only; no explicit message merge fallback found |
| Locale-preserving navigation and redirects | App navigation keeps the active locale | none found | ❌ UNTESTED | Static code shows localized href building, but no passing runtime test |
| Locale-preserving navigation and redirects | Auth redirect keeps the requested locale | none found | ❌ UNTESTED | Protected routes preserve locale; landing route does not |
| Locale-preserving navigation and redirects | Profile-completion redirect keeps the active locale | none found | ❌ UNTESTED | Static redirect wiring exists in dashboard/onboarding paths |
| Localized phase-1 visible content | Landing page content is localized | none found | ❌ UNTESTED | Also blocked for signed-out users because landing redirects before render |
| Localized phase-1 visible content | Dashboard content is localized | none found | ❌ UNTESTED | Message dictionaries and `getTranslations` usage exist |
| Localized phase-1 visible content | Share experience content is localized | none found | ❌ UNTESTED | Message dictionaries and `getTranslations` usage exist |
| Localized phase-1 visible content | App chrome content is localized | none found | ❌ UNTESTED | Message dictionaries and `useTranslations` usage exist |
| Locale-aware metadata for phase-1 surfaces | Localized route emits locale-correct page metadata | none found | ❌ UNTESTED | Implemented for dashboard/share/onboarding; missing for localized landing |
| Locale-aware metadata for phase-1 surfaces | Discovery metadata includes both supported locales | none found | ❌ UNTESTED | Sitemap emits both locale variants, but no automated verification |

**Compliance summary**: 0/13 scenarios compliant by passing frontend tests.

---

### Correctness (Static + Runtime)

| Area | Status | Notes |
|---|---|---|
| Locale-prefixed routing foundation | ✅ Implemented | `middleware.ts`, `src/i18n/*`, and `app/[locale]/*` exist and build |
| Root default locale redirect | ✅ Implemented | Runtime probe confirmed `/` redirects to `/en` |
| Locale-preserving protected redirects | ✅ Implemented | `/es/dashboard`, `/es/share`, `/es/onboarding` preserve locale in `returnTo` |
| Public localized landing behavior | ❌ Broken | `app/[locale]/page.tsx` redirects unauthenticated users to login instead of rendering the landing page |
| Landing locale preservation on auth entry | ❌ Broken | `/es` redirects to `/auth/login?returnTo=/en/dashboard`, losing the requested locale |
| Landing metadata localization | ❌ Missing | `app/[locale]/page.tsx` has no `generateMetadata`/`metadata`; localized landing metadata was required by proposal/spec |
| Dashboard/share/onboarding metadata | ✅ Implemented | Those pages call `buildPageMetadata({ locale, ... })` |
| Sitemap locale variants | ✅ Partial | Both locale URLs are emitted, but no `alternates.languages` metadata is present in sitemap entries |
| Localized visible copy in scoped surfaces | ⚠️ Partial | Landing/dashboard/share/chrome are localized, but groups/rankings/admin/profile-edit remain largely English by design or current implementation |
| English fallback for missing Spanish messages | ⚠️ Unproven / likely missing | Current `request.ts` imports only the active locale JSON; no default-locale merge fallback was found |
| Locale-aware links | ⚠️ Partial | Locale-prefixed paths are constructed in many places, but several components still import `next/link` instead of the shared `next-intl` navigation helper from design |
| Date localization | ⚠️ Partial | Dashboard/share use active locale, but multiple files still hardcode `Intl.DateTimeFormat("en", ...)` |

---

### Design Coherence

| Design decision | Followed? | Notes |
|---|---|---|
| Use top-level `app/[locale]` segment | ✅ Yes | Route tree migrated under `[locale]` |
| Use `next-intl` request config and dictionaries | ✅ Yes | `src/i18n/request.ts` and locale JSON files exist |
| Compose locale routing with Auth0 in middleware | ✅ Yes | `middleware.ts` composes `next-intl` and Auth0 handling |
| Use locale-aware navigation helpers | ⚠️ Partial | `locale-nav.ts` exists, but route components still use raw `next/link` imports instead of shared `next-intl/navigation` helpers |
| Validate locale with `hasLocale`/`setRequestLocale` and explicit locale plumbing | ⚠️ Deviated | No `hasLocale`, `setRequestLocale`, or `generateStaticParams` found; this likely contributes to locale-resolution drift on landing |
| Localize metadata for phase-1 surfaces | ⚠️ Partial | Implemented for dashboard/share/onboarding, not for localized landing |
| Manual smoke for auth/login/logout, dashboard, share | ❌ No evidence | Required in design/tasks, but no recorded manual checklist evidence exists |

---

### Commit Stack Reviewability

| Commit | Assessment | Notes |
|---|---|---|
| `6e2b2c4` feat(web): add locale routing foundation | ⚠️ Overloaded | Coherent behaviorally, but too large for comfortable review: route moves, dictionaries, middleware, shell layout, and infra all land together (~1252 insertions) |
| `745db44` feat(web): localize phase-one app surfaces | ✅ Mostly coherent | Tells a clear story around localization + redirect/SEO wiring |
| `da06107` feat(web): add localized landing route | ✅ Coherent | Focused behavior slice |

**Stack verdict**: The 3-commit story is understandable by behavior, but the first slice exceeds healthy reviewer load and weakens PR reviewability.

---

### Issues Found

**CRITICAL**

- The localized landing route is functionally wrong for signed-out users: `app/[locale]/page.tsx` redirects immediately to Auth0 instead of rendering the public landing experience required by spec/proposal.
- The Spanish landing auth entry loses locale at runtime: `/es` redirects to `/auth/login?returnTo=/en/dashboard`.
- Localized landing metadata is not implemented.
- No frontend automated tests exist, so **0/13** spec scenarios have passing runtime proof.
- `tasks.md` is not verification-ready: 26 core tasks remain unchecked even though code exists for many of them.
- Manual smoke evidence for locale auth/login/logout, dashboard, and share flows is missing; this remains a blocker before PR/archive.

**WARNING**

- `pnpm web:typecheck` is not clean-state reliable; it fails before build because `tsconfig.json` includes `.next/types/**/*.ts`.
- Several localized route files still use raw `next/link` instead of the shared `next-intl` navigation abstraction described in design.
- Several files still hardcode `Intl.DateTimeFormat("en", ...)`, so locale-sensitive formatting is incomplete.
- Explicit English fallback behavior for missing Spanish messages is not implemented/proven.
- Lint passes with multiple unused imports/variables, which increases noise for reviewers.
- Commit `6e2b2c4` is too large for ideal review workload.

**SUGGESTION**

- Add a lightweight web test harness (Playwright or focused integration coverage) for locale routing, auth `returnTo`, localized metadata, and landing/dashboard/share smoke paths.
- Record the manual verification checklist in the artifact once completed.
- Normalize all locale-aware navigation through one shared abstraction to reduce drift.

---

### Verdict

**FAIL**

The branch has a substantial amount of correct i18n infrastructure and buildable code, but it is **not PR-reviewable yet**: the public localized landing route is broken for signed-out users, landing locale preservation is incorrect, automated frontend verification is absent, and required manual smoke coverage for auth/login/logout, dashboard, and share has not been demonstrated.
