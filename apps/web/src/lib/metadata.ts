import type { Metadata } from "next";

export const SITE_NAME = "WorldPredict";
export const SITE_DESCRIPTION =
  "A social football prediction platform where fans compete with friends, track rankings, and share results without betting mechanics.";
export const SITE_KEYWORDS = [
  "football predictions",
  "soccer predictions",
  "world cup predictor",
  "friends leaderboard",
  "private prediction groups",
  "social sports app",
] as const;

function resolveMetadataBase(): URL {
  const candidate = process.env.APP_BASE_URL ?? process.env.AUTH0_BASE_URL ?? "http://localhost:3000";

  try {
    return new URL(candidate);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadataBase = resolveMetadataBase();

export function buildPageMetadata(input: {
  category?: string;
  description: string;
  image?: string;
  index?: boolean;
  keywords?: readonly string[];
  path: string;
  title: string;
}): Metadata {
  const image = input.image ?? "/assets/hero.png";
  const robots: NonNullable<Metadata["robots"]> =
    input.index === false
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" as const } };

  return {
    title: input.title,
    description: input.description,
    metadataBase,
    keywords: input.keywords ? [...input.keywords] : [...SITE_KEYWORDS],
    category: input.category ?? "sports",
    referrer: "origin-when-cross-origin",
    alternates: {
      canonical: input.path,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: input.path,
      title: input.title,
      description: input.description,
      siteName: SITE_NAME,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      creator: "@worldpredict",
      title: input.title,
      description: input.description,
      images: [image],
    },
    robots,
  };
}
