import type { CSSProperties } from "react";

import { getTeamFlagEmoji, getTeamFlagUrl } from "@/lib/flags";

interface FlagIconProps {
  flagCode: string | null;
  countryCode: string | null;
  /** Fixed size for the flag box (emoji or image). Defaults to "2.25rem" (36px). */
  size?: string;
  className?: string;
}

/**
 * Hybrid flag display: emoji → CDN image → soccer ball fallback.
 *
 * - Prefers native emoji (consistent with OS rendering).
 * - Falls back to flagcdn image for ISO-2 codes when emoji is unavailable.
 * - Falls back to ⚽ only when nothing else is resolvable.
 * - Uses a fixed-size container so emoji and images feel the same scale.
 */
export function FlagIcon({ flagCode, countryCode, size = "2.25rem", className = "" }: FlagIconProps) {
  const emoji = getTeamFlagEmoji(flagCode, countryCode);
  const cdnUrl = getTeamFlagUrl(flagCode, countryCode);

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: `calc(${size} * 0.75)`,
    lineHeight: 1,
  };

  if (emoji) {
    return (
      <span aria-hidden="true" style={containerStyle} className={className}>
        {emoji}
      </span>
    );
  }

  if (cdnUrl) {
    return (
      <span aria-hidden="true" style={containerStyle} className={className}>
        <img
          src={cdnUrl}
          alt=""
          width={80}
          height={53}
          className="rounded-sm"
          style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span aria-hidden="true" style={containerStyle} className={className}>
      ⚽
    </span>
  );
}
