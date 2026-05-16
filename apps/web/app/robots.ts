import type { MetadataRoute } from "next";

import { LOCALES } from "@/i18n/routing";
import { metadataBase } from "@/lib/metadata";

const disallowPaths = [
  "/admin",
  "/dashboard",
  "/groups",
  "/onboarding",
  "/rankings",
  "/share",
  "/auth",
  "/api",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = metadataBase.toString().replace(/\/$/, "");

  // Generate locale-prefixed disallow paths for each locale
  const localeDisallow = LOCALES.flatMap((locale) =>
    disallowPaths.map((path) => `/${locale}${path}`),
  );

  // Also disallow bare paths (root-level) to be safe
  const bareDisallow = ["/admin", "/dashboard", "/groups", "/onboarding", "/auth", "/api"];

  return {
    host: baseUrl,
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...localeDisallow, ...bareDisallow],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
