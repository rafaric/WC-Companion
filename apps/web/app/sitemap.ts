import type { MetadataRoute } from "next";

import { LOCALES } from "@/i18n/routing";
import { metadataBase } from "@/lib/metadata";

const localeRoutes = ["/", "/dashboard", "/share", "/onboarding", "/groups", "/rankings", "/admin/external-results"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = metadataBase.toString().replace(/\/$/, "");
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const route of localeRoutes) {
      const localizedPath = `/${locale}${route === "/" ? "" : route}`;
      entries.push({
        url: `${baseUrl}${localizedPath}`,
        lastModified: now,
        changeFrequency: route === "/" ? "daily" : "weekly",
        priority: route === "/" ? 1 : route === "/dashboard" ? 0.9 : 0.7,
      });
    }
  }

  // Add the root URL redirect entry (points to default locale)
  entries.push({
    url: `${baseUrl}/`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 1,
  });

  return entries;
}
