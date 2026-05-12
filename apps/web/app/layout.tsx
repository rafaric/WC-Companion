import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { auth0 } from "@/lib/auth0";
import { getCurrentUserProfile } from "@/lib/api";
import { metadataBase, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME } from "@/lib/metadata";
import { Providers } from "@/app/providers";
import { AppChrome } from "./app-chrome";

import "./globals.css";

const MATCHES_FINALIZE_PERMISSION = "matches:finalize" as const;

function getUserPermissions(user: unknown): string[] {
  if (typeof user !== "object" || user === null || !("permissions" in user)) {
    return [];
  }

  const permissions = (user as { permissions?: unknown }).permissions;

  if (!Array.isArray(permissions) || permissions.some((permission) => typeof permission !== "string")) {
    return [];
  }

  return permissions;
}

export const metadata: Metadata = {
  metadataBase,
  applicationName: SITE_NAME,
  category: "sports",
  keywords: [...SITE_KEYWORDS],
  referrer: "origin-when-cross-origin",
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    url: "/",
    images: [{ url: "/assets/hero.png" }],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@worldpredict",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/assets/hero.png"],
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020617",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth0.getSession();
  let currentUserProfile = null;

  if (session) {
    try {
      const accessToken = (await auth0.getAccessToken()).token;
      currentUserProfile = await getCurrentUserProfile(accessToken);
    } catch {
      currentUserProfile = null;
    }
  }

  const canAccessExternalResults = session ? getUserPermissions(session.user).includes(MATCHES_FINALIZE_PERMISSION) : false;

  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-cyan-300 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950"
        >
          Skip to main content
        </a>
        <Providers>
          <AppChrome
            canAccessExternalResults={canAccessExternalResults}
            currentUserProfile={currentUserProfile}
            sessionUser={session?.user ?? null}
          >
            {children}
          </AppChrome>
        </Providers>
      </body>
    </html>
  );
}
