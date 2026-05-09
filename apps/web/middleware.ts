import type { NextRequest } from "next/server";

import { auth0 } from "@/lib/auth0";

export async function middleware(request: NextRequest) {
  return auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:css|js|map|png|jpg|jpeg|gif|svg|ico|webp|txt|xml)$).*)",
  ],
};
