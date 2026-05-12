import type { MetadataRoute } from "next";

import { metadataBase } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/groups", "/onboarding", "/rankings", "/share"],
      },
    ],
    sitemap: `${metadataBase.toString().replace(/\/$/, "")}/sitemap.xml`,
  };
}
