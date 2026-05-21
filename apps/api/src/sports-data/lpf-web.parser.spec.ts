import { parseLpfPage } from "./lpf-web.parser";

const LPF_FIXTURE_SAMPLE = `TORNEO APERTURA MERCADO LIBRE 2026
FIXTURE
Fecha 1
s	sabado 16 mayo 2026

TC	River		1	0		Central
M	s Monumental	Pagina del partido

domingo 17 mayo 2026

TE+P	Argentinos Jrs.		1	1		Belgrano
Diego Armando Maradona	Pagina del partido
Belgrano Gana por penales 4-3

TC	V	lez		2	1		Talleres
Liniers	Pagina del partido

NS	Racing		-	-	Lan	s
El Cilindro	Pagina del partido

PROMEDIOS
Pos.		PTS	PJ	G	E	P	GF	GC	DG
1	Boca	89	67	62	30	1,786	159`;

const LPF_PARTIAL_SAMPLE = `FIXTURE
sábado 16 mayo 2026
TC	Independiente		3	2		Huracan
Libertadores de America	Pagina del partido
TABLA DE POSICIONES
Pos.	PTS`;

const LPF_NO_VENUE_SAMPLE = `FIXTURE
sábado 16 mayo 2026
TC	Boca		2	0		River
Fecha 2
TE+P	Instituto		0	0		Platense
PROMEDIOS`;

const LPF_NO_DATE_SAMPLE = `FIXTURE
TC	San Lorenzo		1	1		Quilmes
PROMEDIOS`;

const LPF_MULTI_MATCH_SAMPLE = `FIXTURE
Fecha 3
domingo 24 mayo 2026

TC	Talleres		1	0		Belgrano
Mario Alberto Kempes	Pagina del partido

TC	Instituto		2	1		Arsenal
Monumental Alta Cordoba	Pagina del partido

TC	Racing		0	0		Estudiantes
El Cilindro	Pagina del partido

NS	Defensa		-	-	Godoy Cruz
PROMEDIOS`;

const LPF_HTML_SAMPLE = `<html><body>
<section><h2>Noticias previas</h2><p>TC\tFake\t\t9\t9\t\tNoise</p></section>
<main>
<h1>TORNEO APERTURA MERCADO LIBRE 2026</h1>
<h2>FIXTURE</h2>
<div>Fecha 1</div>
<div>sábado 16 mayo 2026</div>
<div>TC\tRiver\t\t1\t0\t\tCentral</div>
<div>Mâs Monumental\tPágina del partido</div>
<div>TE+P\tArgentinos Jrs.\t\t1\t1\t\tBelgrano</div>
<div>Diego Armando Maradona\tPágina del partido</div>
<div>Belgrano Gana por penales 4-3</div>
<h2>PROMEDIOS</h2>
<div>TC\tTable Noise\t\t3\t3\t\tShould Not Parse</div>
</main>
</body></html>`;

const LPF_OPTA_XML_SAMPLE = `<SoccerDocument>
  <MatchData uID="g1">
    <MatchInfo Period="FullTime" MatchDay="1" Venue_id="2939">
      <DateUtc>2026-01-22 20:00:00</DateUtc>
    </MatchInfo>
    <Stat Type="Venue">José María Minella</Stat>
    <TeamData Score="0" Side="Home" TeamRef="t8621" />
    <TeamData Score="0" Side="Away" TeamRef="t8625" />
  </MatchData>
  <MatchData uID="g2">
    <MatchInfo Period="ShootOut" MatchDay="17" Venue_id="4000">
      <DateUtc>2026-05-17 20:00:00</DateUtc>
    </MatchInfo>
    <Stat Type="Venue">Diego Armando Maradona</Stat>
    <TeamData Score="1" Side="Home" TeamRef="t100" />
    <TeamData Score="1" Side="Away" TeamRef="t101" />
  </MatchData>
  <Team uID="t8621"><Name>Aldosivi</Name><ShortTeamName>Aldosivi</ShortTeamName></Team>
  <Team uID="t8625"><Name>Defensa y Justicia</Name><ShortTeamName>Def y Justicia</ShortTeamName></Team>
  <Team uID="t100"><Name>Argentinos Juniors</Name><ShortTeamName>Argentinos Jrs.</ShortTeamName></Team>
  <Team uID="t101"><Name>Belgrano</Name><ShortTeamName>Belgrano</ShortTeamName></Team>
</SoccerDocument>`;

describe("parseLpfPage", () => {
	describe("Opta XML input", () => {
		it("parses the real fixture feed shape used by the LPF page widget", () => {
			const result = parseLpfPage(LPF_OPTA_XML_SAMPLE);

			expect(result.rows).toHaveLength(2);
			expect(result.rows[0]).toMatchObject({
				status: "TC",
				isFinalEligible: true,
				homeTeamName: "Aldosivi",
				awayTeamName: "Def y Justicia",
				homeScore: 0,
				awayScore: 0,
				venueName: "José María Minella",
				dateLabel: "2026-01-22",
			});
		});

		it("maps Opta ShootOut matches as TE+P and not final-eligible", () => {
			const result = parseLpfPage(LPF_OPTA_XML_SAMPLE);
			const shootout = result.rows.find((row) => row.status === "TE+P");

			expect(shootout).toBeDefined();
			expect(shootout!.isFinalEligible).toBe(false);
			expect(shootout!.note).toBe("Opta period: ShootOut");
		});
	});

	describe("HTML input", () => {
		it("strips HTML and parses only the fixture section", () => {
			const result = parseLpfPage(LPF_HTML_SAMPLE);
			const teamNames = result.rows.map((row) => row.homeTeamName);

			expect(teamNames).toEqual(["River", "Argentinos Jrs."]);
			expect(teamNames).not.toContain("Fake");
			expect(teamNames).not.toContain("Table Noise");
			expect(result.rows[0]!.venueName).toBe("Mâs Monumental");
			expect(result.rows[1]!.isFinalEligible).toBe(false);
		});
	});

	describe("date parsing", () => {
		it("extracts date from date heading and associates it with subsequent matches", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const rows = result.rows;

			const sat16Rows = rows.filter((r) => r.dateLabel === "2026-05-16");
			expect(sat16Rows).toHaveLength(1);
			expect(sat16Rows[0]!.homeTeamName).toBe("River");
			expect(sat16Rows[0]!.awayTeamName).toBe("Central");

			const sun17Rows = rows.filter((r) => r.dateLabel === "2026-05-17");
			expect(sun17Rows).toHaveLength(2);
		});
	});

	describe("TC status — final eligible", () => {
		it("marks TC rows as final-eligible", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const tcRows = result.rows.filter((r) => r.status === "TC");

			expect(tcRows.length).toBeGreaterThan(0);
			for (const row of tcRows) {
				expect(row.isFinalEligible).toBe(true);
			}
		});

		it("parses TC scores correctly", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const riverRow = result.rows.find(
				(r) => r.homeTeamName === "River" && r.awayTeamName === "Central",
			);

			expect(riverRow).toBeDefined();
			expect(riverRow!.homeScore).toBe(1);
			expect(riverRow!.awayScore).toBe(0);
		});

		it("does not mark TC rows with missing scores as final-eligible", () => {
			const result = parseLpfPage(`FIXTURE
sábado 16 mayo 2026
TC\tRiver\t\t-\t-\t\tCentral
PROMEDIOS`);

			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]!.isFinalEligible).toBe(false);
		});

		it("parses TC kickoffAt as noon UTC date from date heading", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const row = result.rows.find(
				(r) => r.homeTeamName === "River" && r.awayTeamName === "Central",
			)!;

			const expected = new Date("2026-05-16T12:00:00Z");
			expect(row.kickoffAt.getTime()).toBe(expected.getTime());
		});
	});

	describe("TE+P status — not final eligible", () => {
		it("parses TE+P rows but marks them not final-eligible", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const tepRow = result.rows.find(
				(r) =>
					r.homeTeamName === "Argentinos Jrs." && r.awayTeamName === "Belgrano",
			);

			expect(tepRow).toBeDefined();
			expect(tepRow!.status).toBe("TE+P");
			expect(tepRow!.isFinalEligible).toBe(false);
			expect(tepRow!.homeScore).toBe(1);
			expect(tepRow!.awayScore).toBe(1);
		});

		it("captures note for TE+P penalty result", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const tepRow = result.rows.find(
				(r) =>
					r.homeTeamName === "Argentinos Jrs." && r.awayTeamName === "Belgrano",
			)!;

			expect(tepRow!.note).toBe("Belgrano Gana por penales 4-3");
		});
	});

	describe("venue parsing", () => {
		it("extracts venue name from the line following a match row", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const row = result.rows.find(
				(r) => r.homeTeamName === "River" && r.awayTeamName === "Central",
			)!;

			expect(row.venueName).toBe("M	s Monumental");
		});

		it("sets venueName to null when no venue line is present", () => {
			const result = parseLpfPage(LPF_NO_VENUE_SAMPLE);
			const row = result.rows.find(
				(r) => r.homeTeamName === "Boca" && r.awayTeamName === "River",
			)!;

			expect(row.venueName).toBeNull();
		});
	});

	describe("section boundary", () => {
		it("stops parsing before PROMEDIOS section", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const teamNames = result.rows.map((r) => r.homeTeamName);

			expect(teamNames).not.toContain("Boca");
		});

		it("stops parsing before TABLA DE POSICIONES section", () => {
			const result = parseLpfPage(LPF_PARTIAL_SAMPLE);
			const teamNames = result.rows.map((r) => r.homeTeamName);

			expect(teamNames).not.toContain("Pos.");
			expect(teamNames).toContain("Independiente");
		});
	});

	describe("skipped count", () => {
		it("increments skippedCount for matches without a date heading", () => {
			const result = parseLpfPage(LPF_NO_DATE_SAMPLE);

			expect(result.rows).toHaveLength(0);
			expect(result.skippedCount).toBeGreaterThan(0);
		});
	});

	describe("NS status", () => {
		it("parses NS rows with null scores", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const nsRow = result.rows.find(
				(r) => r.homeTeamName === "Racing" && r.awayTeamName === "Lan	s",
			);

			expect(nsRow).toBeDefined();
			expect(nsRow!.status).toBe("NS");
			expect(nsRow!.isFinalEligible).toBe(false);
			expect(nsRow!.homeScore).toBeNull();
			expect(nsRow!.awayScore).toBeNull();
		});
	});

	describe("multiple matches on same day", () => {
		it("associates all matches with the current date heading", () => {
			const result = parseLpfPage(LPF_MULTI_MATCH_SAMPLE);
			const fecha3 = result.rows.filter((r) => r.dateLabel === "2026-05-24");

			expect(fecha3).toHaveLength(4);
		});
	});

	describe("team name extraction", () => {
		it("handles team names with dots (Jrs.)", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const row = result.rows.find((r) => r.awayTeamName === "Belgrano")!;

			expect(row.homeTeamName).toBe("Argentinos Jrs.");
		});

		it("handles multi-word team names", () => {
			const result = parseLpfPage(LPF_FIXTURE_SAMPLE);
			const row = result.rows.find(
				(r) => r.homeTeamName === "Argentinos Jrs.",
			)!;

			expect(row.awayTeamName).toBe("Belgrano");
		});
	});
});
