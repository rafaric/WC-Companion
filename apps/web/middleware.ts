import createNextIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { auth0 } from "@/lib/auth0";

// Create next-intl middleware for locale handling
const intlMiddleware = createNextIntlMiddleware({
  localePrefix: "always",
  locales: routing.locales,
  defaultLocale: routing.defaultLocale,
  localeDetection: true,
});

export async function middleware(request: NextRequest) {
  // Get the pathname
  const pathname = request.nextUrl.pathname;

  // Skip intl for Auth0 routes and API routes
  const isAuthRoute = pathname.startsWith("/auth");
  const isApiRoute = pathname.startsWith("/api");

  if (isAuthRoute || isApiRoute) {
    // Let Auth0 handle auth routes and API routes directly
    return auth0.middleware(request);
  }

  // Run intl middleware first for locale detection/redirection
  const intlResponse = intlMiddleware(request);

  // If intl middleware issued a redirect (e.g., / → /en), return it
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  // For locale-prefixed routes, also pass to Auth0 for session handling.
  // IMPORTANT: preserve headers/cookies that next-intl adds to carry the resolved locale.
  const authResponse = await auth0.middleware(request);

  intlResponse.headers.forEach((value, key) => {
    authResponse.headers.set(key, value);
  });

  return authResponse;
}

export const config = {
  matcher: [
    // Run middleware for app routes and Auth0 routes, but skip Next internals, API routes,
    // and any request that already targets a static asset / public file (has a file extension).
    "/((?!api|_next|.*\\..*).*)",
  ],
};
