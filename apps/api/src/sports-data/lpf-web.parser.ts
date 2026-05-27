/**
 * LPF page parser: converts raw HTML/text into normalized match rows.
 *
 * The LPF page shows fixture data in readable text form. The parser:
 * 1. Extracts the fixture section between "FIXTURE" and the next major section.
 * 2. Tracks date context from page headings (e.g. "sábado 16 mayo 2026").
 * 3. Parses rows beginning with status tokens (TC, TE+P, NS, 1H, 2H, etc.).
 * 4. Reads the following non-empty line as venue when it is not a heading.
 * 5. Stops before standings/tables sections (PROMEDIOS, TABLA DE POSICIONES, etc.).
 */

import type { LpfWebMatchRow, LpfWebParseResult } from "./lpf-web.types";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Section headings that mark the end of the fixture block. */
const SECTION_STOPS = [
	"PROMEDIOS",
	"TABLA DE POSICIONES",
	"TABLA GENERAL",
	"GOLEADORES",
	"RESUMEN",
	"TARJETAS",
];

/** Status tokens that mark the start of a match row. */
const STATUS_TOKENS = ["TC", "TE+P", "NS", "1H", "2H", "HT", "ET", "P", "FT"];

// ─── Month name normalization ───────────────────────────────────────────────────

const MONTH_MAP: Readonly<Record<string, string>> = {
	enero: "01",
	febrero: "02",
	marzo: "03",
	abril: "04",
	mayo: "05",
	junio: "06",
	julio: "07",
	agosto: "08",
	septiembre: "09",
	octubre: "10",
	noviembre: "11",
	diciembre: "12",
};

/** Parses a Spanish date heading like "sábado 16 mayo 2026" into YYYY-MM-DD. */
function parseDateHeading(line: string): string | null {
	// Matches: <optional dayname/noise> <daynum> <monthname> <year>.
	// The fetched LPF text can contain mojibake/control artifacts before the day name,
	// so anchor on the reliable trailing day/month/year segment.
	const match = line.match(/(\d{1,2})\s+([a-zA-ZáéíóúÁÉÍÓÚüÜñÑ]+)\s+(\d{4})$/);
	if (!match) return null;
	const day = match[1]!;
	const monthName = match[2]!;
	const year = match[3]!;
	const month = MONTH_MAP[monthName.toLowerCase()];
	if (!month) return null;
	return `${year}-${month}-${day.padStart(2, "0")}`;
}

/** Whether a line looks like a date heading. */
function isDateHeading(line: string): boolean {
	return parseDateHeading(line.trim()) !== null;
}

/** Whether a line looks like a section stop heading. */
function isSectionStop(line: string): boolean {
	const upper = line.trim().toUpperCase();
	return SECTION_STOPS.some((s) => upper.startsWith(s));
}

/** Whether a line looks like the start of a match row (begins with a status token). */
function isMatchRow(line: string): boolean {
	const trimmed = line.trim();
	return STATUS_TOKENS.some(
		(token) =>
			trimmed === token ||
			trimmed.startsWith(`${token}\t`) ||
			trimmed.startsWith(`${token} `),
	);
}

/** Whether a line looks like another match row or heading (should not be treated as venue). */
function isVenueCandidate(line: string): boolean {
	const t = line.trim();
	if (!t) return false;
	if (isMatchRow(t)) return true;
	if (isDateHeading(t)) return true;
	if (isSectionStop(t)) return true;
	if (/^Fecha\s+\d+/i.test(t)) return true;
	if (/^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{5,}$/.test(t)) return true;
	return false;
}

// ─── Score extraction ──────────────────────────────────────────────────────────

/** Extracts status, teams, and scores from a tab-separated match row.
 *
 * LPF match rows use TAB-separated tokens: [status] [homeTeam] [homeScore] [awayScore] [awayTeam]
 *
 * Examples:
 *   TC\tRiver\t\t1\t0\t\tCentral  →  ['TC', 'River', '1', '0', 'Central']
 *   TE+P\tArgentinos Jrs.\t\t1\t1\t\tBelgrano  →  ['TE+P', 'Argentinos Jrs.', '1', '1', 'Belgrano']
 *   NS\tRacing\t\t-\t-\t\tLan\u00fas  →  ['NS', 'Racing', '-', '-', 'Lan\u00fas']
 *
 * The row may contain additional empty tokens between team names and scores;
 * these are filtered out before splitting.
 */
function parseMatchLine(line: string): {
	status: string;
	homeTeam: string;
	awayTeam: string;
	homeScore: number | null;
	awayScore: number | null;
} | null {
	// Split on tabs and remove empty strings
	const tokens = line
		.split("\t")
		.map((t) => t.trim())
		.filter((t) => t.length > 0);

	// Structure: [status, homeTeam, homeScore, awayScore, awayTeam]
	if (tokens.length < 5) return null;

	const status = tokens[0]!;
	if (!STATUS_TOKENS.includes(status)) return null;

	// Scores are always positions 2 and 3 (tokens[2] and tokens[3]), never at the end.
	const homeScoreRaw = tokens[2]!;
	const awayScoreRaw = tokens[3]!;

	// Parse scores — allow null for NS/pending matches
	const homeScore = homeScoreRaw === "-" ? null : Number(homeScoreRaw);
	const awayScore = awayScoreRaw === "-" ? null : Number(awayScoreRaw);
	if (homeScore !== null && Number.isNaN(homeScore)) return null;
	if (awayScore !== null && Number.isNaN(awayScore)) return null;

	const homeTeam = tokens[1]!.trim();
	const awayTeam = tokens.slice(4).join("\t").trim();

	if (!homeTeam || !awayTeam) return null;

	return { status, homeTeam, awayTeam, homeScore, awayScore };
}

function parseVenueLine(line: string): string {
	return line.replace(/\tP[aá]gina.*$/i, "").trim();
}

function decodeBasicHtmlEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&#8211;/g, "–")
		.replace(/&#8217;/g, "'")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#038;/g, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">");
}

function stripHtmlToText(raw: string): string {
	return decodeBasicHtmlEntities(raw)
		.replace(/<\s*br\s*\/?>/gi, "\n")
		.replace(/<\s*\/(p|div|section|article|li|tr|h[1-6])\s*>/gi, "\n")
		.replace(/<\s*(td|th|span)\b[^>]*>/gi, "\t")
		.replace(/<[^>]+>/g, "")
		.replace(/\r\n/g, "\n");
}

function extractFixtureSection(rawText: string): string {
	const fixtureIndex = rawText.search(/(^|\n)\s*FIXTURE\s*(\n|$)/i);
	if (fixtureIndex === -1) {
		return rawText;
	}

	const fixtureText = rawText.slice(fixtureIndex);
	const stopMatches = SECTION_STOPS.map((stop) =>
		fixtureText.search(new RegExp(`(^|\\n)\\s*${stop}`, "i")),
	).filter((index) => index > 0);
	const stopIndex = stopMatches.length > 0 ? Math.min(...stopMatches) : -1;

	return stopIndex === -1 ? fixtureText : fixtureText.slice(0, stopIndex);
}

function normalizePageText(raw: string): string {
	return extractFixtureSection(stripHtmlToText(raw));
}

function getAttribute(fragment: string, name: string): string | null {
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = fragment.match(new RegExp(`(?:^|\\s)${escapedName}="([^"]*)"`));
	return match?.[1] ?? null;
}

function getTagText(fragment: string, tagName: string): string | null {
	const match = fragment.match(new RegExp(`<${tagName}>([^<]*)</${tagName}>`));
	return match?.[1]?.trim() ?? null;
}

function parseOptaXmlDate(dateValue: string | null): Date | null {
	if (!dateValue) return null;
	const parsed = new Date(dateValue.replace(" ", "T") + "Z");
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptaXmlFeed(raw: string): LpfWebParseResult | null {
	if (!raw.includes("<SoccerDocument") || !raw.includes("<MatchData")) {
		return null;
	}

	const teams = new Map<string, { name: string }>();
	for (const match of raw.matchAll(/<Team\s+uID="([^"]+)"[\s\S]*?<\/Team>/g)) {
		const teamXml = match[0];
		const teamId = match[1];
		const shortName = getTagText(teamXml, "ShortTeamName");
		const name = getTagText(teamXml, "Name");
		if (teamId && (shortName || name)) {
			teams.set(teamId, { name: shortName ?? name! });
		}
	}

	const rows: LpfWebMatchRow[] = [];
	let skippedCount = 0;

	for (const match of raw.matchAll(/<MatchData\b[\s\S]*?<\/MatchData>/g)) {
		const matchXml = match[0];
		const matchInfo = matchXml.match(/<MatchInfo\b[^>]*>/)?.[0] ?? "";
		const period = getAttribute(matchInfo, "Period");
		const kickoffAt = parseOptaXmlDate(getTagText(matchXml, "DateUtc"));
		const homeTeam =
			matchXml.match(/<TeamData\b[^>]*Side="Home"[^>]*>/)?.[0] ?? null;
		const awayTeam =
			matchXml.match(/<TeamData\b[^>]*Side="Away"[^>]*>/)?.[0] ?? null;
		const homeTeamRef = homeTeam ? getAttribute(homeTeam, "TeamRef") : null;
		const awayTeamRef = awayTeam ? getAttribute(awayTeam, "TeamRef") : null;
		const homeTeamName = homeTeamRef ? teams.get(homeTeamRef)?.name : null;
		const awayTeamName = awayTeamRef ? teams.get(awayTeamRef)?.name : null;

		if (
			!kickoffAt ||
			!homeTeam ||
			!awayTeam ||
			!homeTeamName ||
			!awayTeamName
		) {
			skippedCount++;
			continue;
		}

		const homeScoreRaw = getAttribute(homeTeam, "Score");
		const awayScoreRaw = getAttribute(awayTeam, "Score");
		const homeScore = homeScoreRaw === null ? null : Number(homeScoreRaw);
		const awayScore = awayScoreRaw === null ? null : Number(awayScoreRaw);
		if (
			(homeScore !== null && Number.isNaN(homeScore)) ||
			(awayScore !== null && Number.isNaN(awayScore))
		) {
			skippedCount++;
			continue;
		}

		const status =
			period === "FullTime" ? "TC" : period === "ShootOut" ? "TE+P" : "NS";
		const venueName =
			matchXml.match(/<Stat\s+Type="Venue">([^<]*)<\/Stat>/)?.[1]?.trim() ??
			null;

		rows.push({
			status,
			isFinalEligible:
				status === "TC" && homeScore !== null && awayScore !== null,
			dateLabel: kickoffAt.toISOString().slice(0, 10),
			kickoffAt,
			homeTeamName,
			awayTeamName,
			homeScore,
			awayScore,
			venueName,
			note: period && period !== "FullTime" ? `Opta period: ${period}` : null,
		});
	}

	return { rows, skippedCount };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parses the raw LPF page HTML/text into normalized match rows.
 *
 * @param raw - Raw page HTML/text content from the LPF tournament page.
 * @returns Parsed rows and a skipped-count diagnostic.
 */
export function parseLpfPage(raw: string): LpfWebParseResult {
	const xmlResult = parseOptaXmlFeed(raw);
	if (xmlResult) return xmlResult;

	const rows: LpfWebMatchRow[] = [];
	let skippedCount = 0;
	let currentDate: string | null = null;

	const lines = normalizePageText(raw)
		.split(/\r?\n/)
		.map((l) => l.trim());

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;

		if (isSectionStop(line)) break;

		if (isDateHeading(line)) {
			currentDate = parseDateHeading(line);
			continue;
		}

		if (isMatchRow(line)) {
			const parsed = parseMatchLine(line);
			if (!parsed) {
				skippedCount++;
				continue;
			}

			// Use current date context; if none found, skip
			if (!currentDate) {
				skippedCount++;
				continue;
			}

			// Construct kickoffAt — use noon on the current date
			const kickoffAt = new Date(`${currentDate}T12:00:00Z`);
			if (Number.isNaN(kickoffAt.getTime())) {
				skippedCount++;
				continue;
			}

			// Look ahead for venue: the next non-empty line that is not another heading
			let venueName: string | null = null;
			for (let j = i + 1; j < lines.length; j++) {
				const next = lines[j]!;
				if (!next) continue;
				if (isVenueCandidate(next)) break;
				venueName = parseVenueLine(next);
				break;
			}

			// Look ahead for note: lines after venue until next match/date/heading
			let note: string | null = null;
			if (venueName) {
				for (let j = i + 2; j < lines.length; j++) {
					const nxt = lines[j]!;
					if (!nxt) continue;
					if (isMatchRow(nxt) || isDateHeading(nxt) || isSectionStop(nxt))
						break;
					if (isVenueCandidate(nxt) && nxt !== venueName) break;
					note = nxt;
					break;
				}
			}

			rows.push({
				status: parsed.status,
				isFinalEligible:
					parsed.status === "TC" &&
					parsed.homeScore !== null &&
					parsed.awayScore !== null,
				dateLabel: currentDate,
				kickoffAt,
				homeTeamName: parsed.homeTeam,
				awayTeamName: parsed.awayTeam,
				homeScore: parsed.homeScore,
				awayScore: parsed.awayScore,
				venueName,
				note,
			});
		}
	}

	return { rows, skippedCount };
}
