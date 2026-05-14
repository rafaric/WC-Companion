## Verification Report

**Change**: tournament-selector-multi-tournament-context
**Scope**: PR2 only — selector UI + cookie handling
**Version**: N/A
**Mode**: Standard
**Artifact store**: hybrid

### Completeness
| Metric | Value |
|--------|-------|
| PR2-relevant tasks total | 14 |
| PR2-relevant tasks complete | 10 |
| PR2-relevant tasks incomplete | 4 |

### Build & Tests Execution
**Build**: ✅ Passed (`pnpm web:build`)
```text
Next.js web app built successfully. Existing Auth0/Edge warnings remain, but the build completed.
```

**Typecheck**: ❌ Failed (`pnpm web:typecheck`)
```text
src/lib/__tests__/tournament-context.test.ts(5,38): error TS2307: Cannot find module 'vitest' or its corresponding type declarations.
.next/types/app/api/debug/access-token/route.ts(...): Cannot find module '../../../../../../app/api/debug/access-token/route.js'
```

**Tests**: ❌ 0 passed / ❌ 1 failed / ⚠️ 0 skipped
```text
Command: pnpm --filter @worldpredict/web exec vitest run src/lib/__tests__/tournament-context.test.ts
Result: ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL — Command "vitest" not found
```

**Coverage**: ➖ Not available

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Global app shell tournament selector | Selector is visible from the shared shell | (none found) | ❌ UNTESTED |
| Global app shell tournament selector | Selector reflects persisted choice on a later visit | (none found) | ❌ UNTESTED |
| Tournament selection cookie persistence | Persist selected tournament after user change | (none found) | ❌ UNTESTED |
| Tournament selection cookie persistence | Ignore malformed persisted tournament cookie | (none found) | ❌ UNTESTED |

**Compliance summary**: 0/4 PR2 scenarios compliant

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Selector visible in the shared shell | ❌ Not effectively implemented | New selector/layout files were added under `apps/web/src/app/*`, but the live App Router for this repo is `apps/web/app/*`. The running shell (`apps/web/app/layout.tsx` + `apps/web/app/app-chrome.tsx`) never renders `TournamentSelectorServer`. |
| Persisted choice reflected on later visit | ❌ Not effectively implemented | `apps/web/src/app/page.tsx` reads the cookie, but that page is also outside the live router tree, so the real home page keeps calling `getActiveTournament()` and `getActiveTournamentMatches()` without selected tournament context. |
| Cookie write behavior | ⚠️ Partial | Client component writes `document.cookie`, but it bypasses the helper utilities and omits the `Secure` attribute/path builder logic defined in `apps/web/src/lib/tournament-context.ts`. |
| Malformed cookie fallback | ⚠️ Partial | `parseTournamentSlug()` rejects malformed slugs statically, but there is no runnable test evidence and no validation against known tournament options before rendering selected state. |
| PR2 regression coverage | ❌ Missing | The added `vitest` test file cannot run because `vitest` is not installed/configured in `apps/web`. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cookie stores slug | ✅ Yes | The implementation uses `wc_tournament=<slug>`. |
| Shared shell reads cookie server-side | ❌ No | Cookie-aware shell/page logic was placed in `apps/web/src/app/*`, not the active `apps/web/app/*` shell. |
| Selector integration in shared app shell | ❌ No | The active shell remains `AppChrome` without selector integration. |
| Runtime verification for PR2 behavior | ❌ No | No passing covering test exists; the only new test file is not executable. |

### Issues Found
**CRITICAL**:
- The selector UI is NOT wired into the live Next.js application. All PR2 UI work was added under `apps/web/src/app/*`, while this repository's real App Router lives under `apps/web/app/*`. Result: users cannot see or use the selector in the running app.
- The cookie-aware home page is also in the unused `src/app` tree, so persisted tournament choice does not affect the real home/dashboard shell behavior.
- PR2 has no passing covering tests. The new `tournament-context.test.ts` cannot run because `vitest` is missing, which leaves all PR2 spec scenarios unverified.

**WARNING**:
- `pnpm web:typecheck` fails, partly because the new test imports `vitest` without dependency/config support.
- The selector component writes cookies manually instead of reusing `buildTournamentCookieValue()`, so the implemented write path diverges from the defined cookie utility contract.
- The selector only validates slug format, not whether the persisted slug exists in the available tournament list before treating it as selected state.

**SUGGESTION**:
- Move PR2 integration into the real `apps/web/app/*` shell (likely `app/layout.tsx` and/or `app/app-chrome.tsx`) instead of the unused `src/app/*` tree.
- Add an actual supported web test path before claiming verification — either install/configure Vitest for this package or replace the test with the repo's supported test tooling.
- Reuse the cookie helper for client writes so expiration/security behavior stays centralized and consistent.

### Verdict
FAIL
PR2 is not ready for commit/review and it is not safe to proceed to PR3 because the selector is not mounted in the live app and the slice has no passing verification evidence.
