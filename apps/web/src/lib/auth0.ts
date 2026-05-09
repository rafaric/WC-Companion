import { Auth0Client } from "@auth0/nextjs-auth0/server";

function readAuth0Domain(): string | undefined {
  const candidate = process.env.AUTH0_DOMAIN?.trim() ?? process.env.AUTH0_ISSUER_BASE_URL?.trim();

  if (!candidate) {
    return undefined;
  }

  try {
    const normalizedIssuer = candidate.includes("://") ? candidate : `https://${candidate}`;

    return new URL(normalizedIssuer).hostname;
  } catch {
    return candidate.replace(/^https?:\/\//, "").split("/")[0];
  }
}

const appBaseUrl = process.env.APP_BASE_URL ?? process.env.AUTH0_BASE_URL;

export const auth0 = new Auth0Client({
  domain: readAuth0Domain(),
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  appBaseUrl,
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    scope: "openid profile email",
  },
});
