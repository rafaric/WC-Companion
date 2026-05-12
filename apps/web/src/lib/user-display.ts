import type { CurrentUserProfile } from "@/lib/api";

export interface SessionDisplayUser {
  name?: string | null;
  nickname?: string | null;
  email?: string | null;
  sub?: string | null;
}

const EMAIL_PLACEHOLDER_DOMAIN = "@users.invalid";

export function looksLikeEmail(value: string | null | undefined): value is string {
  return typeof value === "string" && value.includes("@");
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.endsWith(EMAIL_PLACEHOLDER_DOMAIN);
}

function extractEmailLocalPart(email: string | null | undefined): string | null {
  if (typeof email !== "string" || email.length === 0 || isPlaceholderEmail(email)) {
    return null;
  }

  const [localPart] = email.split("@");
  return localPart?.trim() ? localPart : null;
}

export function getFriendlyDisplayName(user: SessionDisplayUser, profile?: CurrentUserProfile | null): string {
  if (user.name && !looksLikeEmail(user.name)) {
    return user.name;
  }

  if (user.nickname && !looksLikeEmail(user.nickname)) {
    return user.nickname;
  }

  if (profile?.username) {
    return profile.username;
  }

  const emailLocalPart = extractEmailLocalPart(user.email ?? profile?.email);
  if (emailLocalPart) {
    return emailLocalPart;
  }

  return user.sub ?? "You";
}

export function getFriendlyEmailLabel(user: SessionDisplayUser, profile?: CurrentUserProfile | null): string {
  if (user.email && !isPlaceholderEmail(user.email)) {
    return user.email;
  }

  if (profile?.email && !isPlaceholderEmail(profile.email)) {
    return profile.email;
  }

  return "Email not shared";
}
