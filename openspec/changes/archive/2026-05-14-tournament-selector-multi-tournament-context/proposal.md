# Tournament Selector Multi-Tournament Context - Phase 1 Proposal

## Intent and Motivation
The current system assumes exactly one ACTIVE tournament used throughout API and web layers, causing demo fixtures (world-cup-2026-demo) to mix with football-data-backed fixtures when both tournaments are marked ACTIVE. This change introduces a visible tournament selector that persists selection in cookies, resolves selected tournament before falling back to ACTIVE behavior, and separates demo/manual tournament from provider-backed real tournament while preserving current UX where reasonable.

## Scope for Phase 1
- Add visible tournament selector UI component in web application
- Implement cookie-based persistence for tournament selection
- Modify tournament resolution service to check cookie context first, then fallback to ACTIVE behavior
- Ensure both demo and provider-backed tournaments remain in seed data
- Preserve current UX where reasonable (no breaking changes to existing flows)
- Set up foundation for future slug-based routes without forcing implementation now

## Out-of-Scope Items (Reserved for Later Phases)
- Slug-in-route implementation (tournament/:slug/*)
- URL synchronization with tournament selection
- Deep linking support for specific tournaments
- Admin interface for managing multiple tournaments
- Historical tournament data viewing
- Tournament-specific caching strategies

## Risks and Tradeoffs
### Risks
1. **Inconsistent state**: If cookie contains invalid tournament ID, fallback to ACTIVE may still cause confusion
2. **Performance impact**: Additional cookie lookup on every tournament resolution call
3. **Seed data complexity**: Maintaining both demo and real tournaments in seed data requires careful coordination
4. **UI/UX inconsistency**: Selector may appear on pages where tournament context is irrelevant

### Tradeoffs
- **Cookie persistence vs. URL state**: Chose cookie persistence for immediate implementation simplicity over URL state which requires slug-in-route implementation
- **Immediate fallback vs. error handling**: Selected fallback to ACTIVE behavior over showing error state for better user experience
- **Broad service modification vs. targeted approach**: Modified core tournament resolution service rather than creating wrapper functions to minimize duplication

## Suggested Change Boundaries
### Core Changes
1. **Tournament Resolution Service** (`apps/api/src/tournaments/tournaments.service.ts`)
   - Modify `getActiveTournament()` to check cookie context first
   - Create new method `getTournamentFromContext()` that handles cookie lookup
   - Maintain backward compatibility with existing ACTIVE-only behavior

2. **Web Layer Integration** (`apps/web/src/lib/api.ts` or similar)
   - Add cookie getter/setter utilities for tournament selection
   - Create tournament selector UI component
   - Integrate selector into layout or header component

3. **Seed Data** (`apps/api/prisma/seed.ts`)
   - Ensure both demo tournament (world-cup-2026-demo) and provider-backed tournaments exist
   - Maintain appropriate statuses (demo may remain ACTIVE for backward compatibility)

### Future-Proofing Boundaries
- Abstract tournament resolution behind interface that can later support slug-based lookup
- Keep service methods focused on tournament ID resolution rather than URL parsing
- Design cookie format to be extensible for future metadata
- Ensure all tournament-consuming services depend on resolved tournament ID, not direct ACTIVE queries

## Implementation Approach
Following the "ask-on-risk" delivery strategy:
1. Implement core tournament resolution changes with cookie fallback
2. Add UI selector component with basic styling
3. Verify existing functionality remains intact through manual testing
4. Request feedback before proceeding to URL-based implementation

## Rollback Plan
1. Revert tournament service modifications to original `getActiveTournament()` implementation
2. Remove tournament selector UI component
3. Clean up cookie utilities
4. Seed data remains unchanged (both tournaments preserved)