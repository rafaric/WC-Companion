/**
 * Flag emoji normalization utilities for country codes.
 *
 * Handles various input formats (FIFA-3, ISO-2, legacy codes like GB-ENG)
 * and returns emoji flags for web display.
 *
 * Flag display is supplementary—always provide accessible country names.
 */

/**
 * Mapping of common FIFA-3 or legacy codes to emoji flags.
 * FIFA-3 codes (ARG, BRA, etc.) or legacy codes (GB-ENG) need explicit mapping.
 */
const FIFA_TO_FLAG: Record<string, string> = {
  // FIFA-3 codes
  ARG: "🇦🇷",
  AUS: "🇦🇺",
  BEL: "🇧🇪",
  BRA: "🇧🇷",
  CMR: "🇨🇲",
  CAN: "🇨🇦",
  CHI: "🇨🇱",
  CHN: "🇨🇳",
  COL: "🇨🇴",
  CRC: "🇨🇷",
  CRO: "🇭🇷",
  DEN: "🇩🇰",
  ECU: "🇪🇨",
  EGY: "🇪🇬",
  ENG: "🏴",
  ESP: "🇪🇸",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  GHA: "🇬🇭",
  HON: "🇭🇳",
  IRN: "🇮🇷",
  IRQ: "🇮🇶",
  ITA: "🇮🇹",
  JAM: "🇯🇲",
  JPN: "🇯🇵",
  KOR: "🇰🇷",
  KSA: "🇸🇦",
  MAR: "🇲🇦",
  MEX: "🇲🇽",
  NED: "🇳🇱",
  NGA: "🇳🇬",
  NOR: "🇳🇴",
  NZL: "🇳🇿",
  PAN: "🇵🇦",
  PAR: "🇵🇾",
  PER: "🇵🇪",
  POL: "🇵🇱",
  POR: "🇵🇹",
  QAT: "🇶🇦",
  ROU: "🇷🇴",
  RSA: "🇿🇦",
  RUS: "🇷🇺",
  SEN: "🇸🇳",
  SRB: "🇷🇸",
  SUI: "🇨🇭",
  SWE: "🇸🇪",
  TUN: "🇹🇳",
  TUR: "🇹🇷",
  UAE: "🇦🇪",
  URU: "🇺🇾",
  USA: "🇺🇸",
  VEN: "🇻🇪",
  WAL: "🏴",
  // Legacy / special codes (converted to ISO-2 where possible)
  "GB-ENG": "🏴",
  "GB-SCT": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "GB-WLS": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "GB-NIR": "🏴󠁧󠁢󠁮󠁩󠁲󠁿",
};

/**
 * Converts a country/flag code to a flag emoji.
 *
 * @param code - The country code (FIFA-3 like "ARG", ISO-2 like "AR", or legacy like "GB-ENG")
 * @returns The flag emoji, or null if the code cannot be resolved
 *
 * @example
 * getFlagEmoji("BRA") // "🇧🇷"
 * getFlagEmoji("GB-ENG") // "🏴"
 * getFlagEmoji("AR") // "🇦🇷"
 * getFlagEmoji("unknown") // null
 */
export function getFlagEmoji(code: string | null): string | null {
  if (!code) {
    return null;
  }

  const normalizedCode = code.trim().toUpperCase();

  // First check explicit FIFA/legacy mapping
  if (FIFA_TO_FLAG[normalizedCode]) {
    return FIFA_TO_FLAG[normalizedCode];
  }

  // Try ISO-2 conversion: convert country code to regional indicator symbols
  // ISO-2 codes are exactly 2 uppercase letters
  if (/^[A-Z]{2}$/.test(normalizedCode)) {
    return String.fromCodePoint(
      ...Array.from(normalizedCode).map((char) => 127397 + char.charCodeAt(0)),
    );
  }

  // Unresolvable: return null (caller should provide fallback)
  return null;
}

/**
 * Gets the best available flag emoji for a team.
 *
 * Tries flagCode first (preferred), then falls back to countryCode.
 * If neither works, returns null.
 *
 * @param flagCode - The team's flag code (preferred)
 * @param countryCode - The team's country code (fallback)
 * @returns The flag emoji, or null if neither code can be resolved
 */
export function getTeamFlagEmoji(flagCode: string | null, countryCode: string | null): string | null {
  return getFlagEmoji(flagCode) ?? getFlagEmoji(countryCode);
}