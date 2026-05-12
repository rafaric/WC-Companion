import type { MetadataRoute } from "next";

import { metadataBase } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = metadataBase.toString().replace(/\/$/, "");

  return {
    host: baseUrl,
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/groups", "/onboarding", "/rankings", "/share"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
