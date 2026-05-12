import type { Metadata } from "next";

export const SITE_NAME = "WorldPredict";
export const SITE_DESCRIPTION =
  "A social football prediction platform where fans compete with friends, track rankings, and share results without betting mechanics.";

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
  description: string;
  image?: string;
  index?: boolean;
  path: string;
  title: string;
}): Metadata {
  const image = input.image ?? "/assets/hero.png";
  const robots = input.index === false ? { index: false, follow: false } : { index: true, follow: true };

  return {
    title: input.title,
    description: input.description,
    metadataBase,
    alternates: {
      canonical: input.path,
    },
    openGraph: {
      type: "website",
      url: input.path,
      title: input.title,
      description: input.description,
      siteName: SITE_NAME,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
    robots,
  };
}
