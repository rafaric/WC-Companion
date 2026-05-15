/**
 * Flag normalization utilities for country codes.
 *
 * The current data feed mixes FIFA-style 3-letter codes, ISO-3 codes, ISO-2 codes,
 * and a few special legacy values like GB-ENG/GB-SCT.
 *
 * We normalize all of those into either:
 * - a locally supported special code, or
 * - a standard ISO-2 code that can be rendered as emoji or CDN image.
 */

const SPECIAL_FLAG_EMOJI: Record<string, string> = {
  ENG: "🏴",
  SCO: "🏴",
  WAL: "🏴",
  "GB-ENG": "🏴",
  "GB-SCT": "🏴",
  "GB-WLS": "🏴",
  "GB-NIR": "🏴",
};

const PROVIDER_TO_ISO2: Record<string, string> = {
  ALG: "DZ",
  ANT: "CW",
  ARG: "AR",
  AUS: "AU",
  AUT: "AT",
  BEL: "BE",
  BIH: "BA",
  BRA: "BR",
  CAN: "CA",
  CHE: "CH",
  CIV: "CI",
  COD: "CD",
  COL: "CO",
  CPV: "CV",
  CRO: "HR",
  CZE: "CZ",
  DEU: "DE",
  ECU: "EC",
  EGY: "EG",
  ESP: "ES",
  FRA: "FR",
  GHA: "GH",
  HRV: "HR",
  HTI: "HT",
  IRN: "IR",
  IRQ: "IQ",
  JOR: "JO",
  JPN: "JP",
  KOR: "KR",
  KSA: "SA",
  MAR: "MA",
  MEX: "MX",
  NLD: "NL",
  NOR: "NO",
  NZL: "NZ",
  PAN: "PA",
  PAR: "PY",
  POR: "PT",
  PRY: "PY",
  QAT: "QA",
  RSA: "ZA",
  SEN: "SN",
  SUI: "CH",
  SWE: "SE",
  TUN: "TN",
  TUR: "TR",
  UAE: "AE",
  URU: "UY",
  URY: "UY",
  USA: "US",
  UZB: "UZ",
};

function isIso2Code(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

function normalizeFlagCode(code: string | null): string | null {
  if (!code) {
    return null;
  }

  const normalizedCode = code.trim().toUpperCase();

  if (normalizedCode in SPECIAL_FLAG_EMOJI) {
    return normalizedCode;
  }

  if (isIso2Code(normalizedCode)) {
    return normalizedCode;
  }

  return PROVIDER_TO_ISO2[normalizedCode] ?? null;
}

/**
 * Converts a country/flag code to a flag emoji.
 */
export function getFlagEmoji(code: string | null): string | null {
  const normalizedCode = normalizeFlagCode(code);

  if (!normalizedCode) {
    return null;
  }

  if (SPECIAL_FLAG_EMOJI[normalizedCode]) {
    return SPECIAL_FLAG_EMOJI[normalizedCode];
  }

  if (!isIso2Code(normalizedCode)) {
    return null;
  }

  return String.fromCodePoint(
    ...Array.from(normalizedCode).map((char) => 127397 + char.charCodeAt(0)),
  );
}

function getFlagCdnUrl(code: string | null): string | null {
  const normalizedCode = normalizeFlagCode(code);

  if (!normalizedCode || SPECIAL_FLAG_EMOJI[normalizedCode]) {
    return null;
  }

  if (isIso2Code(normalizedCode)) {
    return `https://flagcdn.com/w80/${normalizedCode.toLowerCase()}.png`;
  }

  return null;
}

export function getTeamFlagUrl(flagCode: string | null, countryCode: string | null): string | null {
  return getFlagCdnUrl(flagCode) ?? getFlagCdnUrl(countryCode);
}

export function getTeamFlagEmoji(flagCode: string | null, countryCode: string | null): string | null {
  return getFlagEmoji(flagCode) ?? getFlagEmoji(countryCode);
}
