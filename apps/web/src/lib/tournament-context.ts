/**
 * Tournament context utilities for cookie-based tournament selection.
 * Used by both server and client components for reading/writing tournament selection.
 */

// Cookie name for storing selected tournament slug
export const TOURNAMENT_COOKIE_NAME = "wc_tournament";

// Cookie options for persistent storage
export const TOURNAMENT_COOKIE_OPTIONS = {
  // 30 day expiration
  maxAge: 60 * 60 * 24 * 30,
  // Accessible only by HTTP, not JavaScript (security)
  httpOnly: false, // Set to true when we have a server-side solution
  // Same-site for CSRF protection
  sameSite: "lax" as const,
  // Secure in production
  secure: process.env.NODE_ENV === "production",
  // Path to make it available site-wide
  path: "/",
};

/**
 * Tournament context type indicating how the tournament was resolved.
 */
export type TournamentSource = "explicit" | "cookie" | "active";

/**
 * Interface for tournament selection context.
 */
export interface TournamentSelection {
  slug: string;
  source: TournamentSource;
}

/**
 * Server-side function to get tournament slug from cookies.
 * This should be called in Server Components to get the selected tournament.
 *
 * @param headers - Request headers from the server component
 * @returns The selected tournament slug or null if not set
 */
export function getTournamentSlugFromCookies(
  cookies: { get: (name: string) => { value: string } | undefined }
): string | null {
  const cookie = cookies.get(TOURNAMENT_COOKIE_NAME);
  return cookie?.value ?? null;
}

/**
 * Parse a tournament slug from a cookie string value.
 * Validates that the slug is non-empty.
 *
 * @param value - The cookie value (slug string)
 * @returns The slug if valid, null otherwise
 */
export function parseTournamentSlug(value: string | undefined | null): string | null {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return null;
  }
  // Basic slug validation - alphanumeric, dash, underscore
  if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
    return null;
  }
  return value.trim();
}

/**
 * Format a tournament slug for cookie storage.
 * Normalizes the input and validates.
 *
 * @param slug - The tournament slug
 * @returns Formatted slug or empty string if invalid
 */
export function formatTournamentSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    throw new Error(`Invalid tournament slug format: ${slug}`);
  }
  return normalized;
}

/**
 * Build the cookie header value for setting the tournament selection.
 *
 * @param slug - The tournament slug to store
 * @returns The cookie header value string
 */
export function buildTournamentCookieValue(slug: string): string {
  const formattedSlug = formatTournamentSlug(slug);
  return `${TOURNAMENT_COOKIE_NAME}=${formattedSlug}; Path=${TOURNAMENT_COOKIE_OPTIONS.path}; Max-Age=${TOURNAMENT_COOKIE_OPTIONS.maxAge}; SameSite=${TOURNAMENT_COOKIE_OPTIONS.sameSite}`;
}

/**
 * Clear the tournament cookie (for reset to default behavior).
 *
 * @returns The cookie header value to clear the tournament selection
 */
export function clearTournamentCookie(): string {
  return `${TOURNAMENT_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

/**
 * Type guard to check if a value is a valid TournamentSource.
 */
export function isValidTournamentSource(value: string): value is TournamentSource {
  return ["explicit", "cookie", "active"].includes(value);
}