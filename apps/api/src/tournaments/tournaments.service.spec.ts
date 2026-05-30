import { MatchStatus, TournamentStatus } from "@prisma/client";

import type { PrismaService } from "../prisma/prisma.service";
import {
	TournamentsService,
	type TournamentMatchView,
	type TournamentView,
} from "./tournaments.service";

interface TournamentFindFirstArgs {
	where: {
		status?: TournamentStatus;
		slug?: string;
	};
	select: {
		id: boolean;
		name: boolean;
		slug: boolean;
		year: boolean;
		status: boolean;
		startsAt: boolean;
		endsAt: boolean;
	};
}

interface TournamentFindUniqueArgs {
	where: { id: string };
	select: {
		id: boolean;
		name: boolean;
		slug: boolean;
		year: boolean;
		status: boolean;
		startsAt: boolean;
		endsAt: boolean;
	};
}

interface TournamentFindManyArgs {
	orderBy: { status?: string; year?: string; name?: string }[];
	select: {
		id: boolean;
		name: boolean;
		slug: boolean;
		year: boolean;
		status: boolean;
		startsAt: boolean;
		endsAt: boolean;
	};
}

interface MatchFindManyArgs {
	where: {
		tournamentId: string;
	};
	orderBy: {
		kickoffAt: "asc";
	};
	select: {
		id: boolean;
		tournamentId: boolean;
		stage: boolean;
		groupName: boolean;
		kickoffAt: boolean;
		status: boolean;
		homeScore: boolean;
		awayScore: boolean;
		finalizedAt: boolean;
		homeTeam: {
			select: {
				id: boolean;
				name: boolean;
				shortName: boolean;
				countryCode: boolean;
				flagCode: boolean;
				primaryColor: boolean;
				secondaryColor: boolean;
			};
		};
		awayTeam: {
			select: {
				id: boolean;
				name: boolean;
				shortName: boolean;
				countryCode: boolean;
				flagCode: boolean;
				primaryColor: boolean;
				secondaryColor: boolean;
			};
		};
	};
}

interface TournamentRecord extends TournamentView {}

interface MatchRecord {
	id: string;
	tournamentId: string;
	stage: string | null;
	groupName: string | null;
	kickoffAt: Date;
	status: MatchStatus;
	homeScore: number | null;
	awayScore: number | null;
	finalizedAt: Date | null;
	homeTeam: {
		id: string;
		name: string;
		shortName: string;
		countryCode: string | null;
		flagCode: string | null;
		primaryColor: string | null;
		secondaryColor: string | null;
		crestUrl: string | null;
	};
	awayTeam: {
		id: string;
		name: string;
		shortName: string;
		countryCode: string | null;
		flagCode: string | null;
		primaryColor: string | null;
		secondaryColor: string | null;
		crestUrl: string | null;
	};
}

interface PrismaMockState {
	tournaments: TournamentRecord[];
	matches: MatchRecord[];
}

interface PrismaMock {
	tournament: {
		findFirst: jest.Mock<
			Promise<TournamentRecord | null>,
			[TournamentFindFirstArgs]
		>;
		findUnique: jest.Mock<
			Promise<TournamentRecord | null>,
			[TournamentFindUniqueArgs]
		>;
		findMany: jest.Mock<Promise<TournamentRecord[]>, unknown[]>;
	};
	match: {
		findMany: jest.Mock<Promise<MatchRecord[]>, [MatchFindManyArgs]>;
	};
}

function createTournament(
	overrides: Partial<TournamentRecord> = {},
): TournamentRecord {
	return {
		id: "tournament-1",
		name: "World Cup 2026 Demo",
		slug: "world-cup-2026-demo",
		year: 2026,
		status: TournamentStatus.ACTIVE,
		startsAt: new Date("2026-06-11T00:00:00.000Z"),
		endsAt: new Date("2026-07-19T00:00:00.000Z"),
		providerKey: null,
		...overrides,
	};
}

function createMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
	return {
		id: "match-1",
		tournamentId: "tournament-1",
		stage: "Group Stage",
		groupName: "Group A",
		kickoffAt: new Date("2026-06-11T16:00:00.000Z"),
		status: MatchStatus.UPCOMING,
		homeScore: null,
		awayScore: null,
		finalizedAt: null,
		homeTeam: {
			id: "team-1",
			name: "Argentina",
			shortName: "ARG",
			countryCode: "AR",
			flagCode: "ARG",
			primaryColor: "#74ACDF",
			secondaryColor: "#F6E7A1",
			crestUrl: null,
		},
		awayTeam: {
			id: "team-2",
			name: "England",
			shortName: "ENG",
			countryCode: "GB-ENG",
			flagCode: "ENG",
			primaryColor: "#FFFFFF",
			secondaryColor: "#CE1124",
			crestUrl: null,
		},
		...overrides,
	};
}

function toMatchView(match: MatchRecord): TournamentMatchView {
	return {
		id: match.id,
		tournamentId: match.tournamentId,
		stage: match.stage,
		groupName: match.groupName,
		kickoffAt: match.kickoffAt,
		status: match.status,
		homeScore: match.homeScore,
		awayScore: match.awayScore,
		finalizedAt: match.finalizedAt,
		homeTeam: {
			id: match.homeTeam.id,
			name: match.homeTeam.name,
			shortName: match.homeTeam.shortName,
			countryCode: match.homeTeam.countryCode,
			flagCode: match.homeTeam.flagCode,
			colors: {
				primaryColor: match.homeTeam.primaryColor,
				secondaryColor: match.homeTeam.secondaryColor,
			},
			crestUrl: match.homeTeam.crestUrl,
		},
		awayTeam: {
			id: match.awayTeam.id,
			name: match.awayTeam.name,
			shortName: match.awayTeam.shortName,
			countryCode: match.awayTeam.countryCode,
			flagCode: match.awayTeam.flagCode,
			colors: {
				primaryColor: match.awayTeam.primaryColor,
				secondaryColor: match.awayTeam.secondaryColor,
			},
			crestUrl: match.awayTeam.crestUrl,
		},
	};
}

function createPrismaMock(state: PrismaMockState): PrismaMock {
	return {
		tournament: {
			findFirst: jest.fn(async ({ where }) => {
				if (where.status !== undefined) {
					return (
						state.tournaments.find(
							(tournament) => tournament.status === where.status,
						) ?? null
					);
				}
				if (where.slug !== undefined) {
					return (
						state.tournaments.find(
							(tournament) => tournament.slug === where.slug,
						) ?? null
					);
				}
				return null;
			}),
			findUnique: jest.fn(
				async ({ where }) =>
					state.tournaments.find((tournament) => tournament.id === where.id) ??
					null,
			),
			findMany: jest.fn(async () => state.tournaments),
		},
		match: {
			findMany: jest.fn(async ({ where }) =>
				state.matches
					.filter((match) => match.tournamentId === where.tournamentId)
					.sort(
						(left, right) =>
							left.kickoffAt.getTime() - right.kickoffAt.getTime(),
					),
			),
		},
	};
}

describe("TournamentsService", () => {
	it("returns the active tournament", async () => {
		const prisma = createPrismaMock({
			tournaments: [createTournament()],
			matches: [],
		});
		const service = new TournamentsService(prisma as unknown as PrismaService);

		const tournament = await service.getActiveTournament();

		expect(tournament).toEqual(createTournament());
		expect(prisma.tournament.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { status: TournamentStatus.ACTIVE },
			}),
		);
	});

	it("throws when the active tournament is missing", async () => {
		const prisma = createPrismaMock({ tournaments: [], matches: [] });
		const service = new TournamentsService(prisma as unknown as PrismaService);

		await expect(service.getActiveTournament()).rejects.toThrow(
			"Active tournament not found",
		);
	});

	it("returns active tournament matches ordered by kickoff time with team data", async () => {
		const firstMatch = createMatch({
			id: "match-early",
			kickoffAt: new Date("2026-06-11T12:00:00.000Z"),
		});
		const secondMatch = createMatch({
			id: "match-late",
			kickoffAt: new Date("2026-06-12T12:00:00.000Z"),
			homeTeam: {
				id: "team-3",
				name: "Brazil",
				shortName: "BRA",
				countryCode: "BR",
				flagCode: "BRA",
				primaryColor: "#009C3B",
				secondaryColor: "#FFDF00",
				crestUrl: null,
			},
			awayTeam: {
				id: "team-4",
				name: "Germany",
				shortName: "GER",
				countryCode: "DE",
				flagCode: "GER",
				primaryColor: "#000000",
				secondaryColor: "#DD0000",
				crestUrl: null,
			},
		});
		const prisma = createPrismaMock({
			tournaments: [createTournament()],
			matches: [secondMatch, firstMatch],
		});
		const service = new TournamentsService(prisma as unknown as PrismaService);

		const matches = await service.getActiveTournamentMatches();

		expect(matches).toEqual([
			toMatchView(firstMatch),
			toMatchView(secondMatch),
		]);
		expect(matches[0]?.homeTeam.colors).toEqual({
			primaryColor: "#74ACDF",
			secondaryColor: "#F6E7A1",
		});
		expect(prisma.match.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { tournamentId: "tournament-1" },
				orderBy: { kickoffAt: "asc" },
			}),
		);
	});

	describe("listTournaments", () => {
		it("returns all tournaments ordered by status, year, name", async () => {
			const secondTournament = createTournament({
				id: "tournament-2",
				name: "World Cup 2030",
				slug: "world-cup-2030",
				year: 2030,
				status: TournamentStatus.DRAFT,
			});
			const prisma = createPrismaMock({
				tournaments: [createTournament(), secondTournament],
				matches: [],
			});
			const service = new TournamentsService(
				prisma as unknown as PrismaService,
			);

			const tournaments = await service.listTournaments();

			expect(tournaments).toHaveLength(2);
			expect(tournaments[0]?.id).toBe("tournament-1"); // ACTIVE first
			expect(tournaments[1]?.id).toBe("tournament-2"); // DRAFT second
		});
	});

	describe("resolveTournamentContext", () => {
		it("resolves explicit tournament ID when provided", async () => {
			const prisma = createPrismaMock({
				tournaments: [createTournament()],
				matches: [],
			});
			const service = new TournamentsService(
				prisma as unknown as PrismaService,
			);

			const result = await service.resolveTournamentContext({
				explicitTournamentId: "tournament-1",
			});

			expect(result.tournament.id).toBe("tournament-1");
			expect(result.source).toBe("explicit");
		});

		it("resolves selected slug from cookie when provided", async () => {
			const prisma = createPrismaMock({
				tournaments: [createTournament()],
				matches: [],
			});
			const service = new TournamentsService(
				prisma as unknown as PrismaService,
			);

			const result = await service.resolveTournamentContext({
				selectedSlug: "world-cup-2026-demo",
			});

			expect(result.tournament.slug).toBe("world-cup-2026-demo");
			expect(result.source).toBe("cookie");
		});

		it("falls back to ACTIVE tournament when no context provided", async () => {
			const prisma = createPrismaMock({
				tournaments: [createTournament()],
				matches: [],
			});
			const service = new TournamentsService(
				prisma as unknown as PrismaService,
			);

			const result = await service.resolveTournamentContext({});

			expect(result.tournament.status).toBe(TournamentStatus.ACTIVE);
			expect(result.source).toBe("active");
		});

		it("falls back to ACTIVE when selected slug is invalid", async () => {
			const prisma = createPrismaMock({
				tournaments: [createTournament()],
				matches: [],
			});
			const service = new TournamentsService(
				prisma as unknown as PrismaService,
			);

			const result = await service.resolveTournamentContext({
				selectedSlug: "invalid-slug",
			});

			expect(result.tournament.status).toBe(TournamentStatus.ACTIVE);
			expect(result.source).toBe("active");
		});

		it("throws when explicit tournament ID is not found", async () => {
			const prisma = createPrismaMock({
				tournaments: [createTournament()],
				matches: [],
			});
			const service = new TournamentsService(
				prisma as unknown as PrismaService,
			);

			await expect(
				service.resolveTournamentContext({
					explicitTournamentId: "non-existent-id",
				}),
			).rejects.toThrow("Tournament non-existent-id was not found");
		});

		it("prefers explicit ID over selected slug", async () => {
			const secondTournament = createTournament({
				id: "tournament-2",
				name: "World Cup 2026 Real",
				slug: "world-cup-2026",
				year: 2026,
				status: TournamentStatus.DRAFT,
			});
			const prisma = createPrismaMock({
				tournaments: [createTournament(), secondTournament],
				matches: [],
			});
			const service = new TournamentsService(
				prisma as unknown as PrismaService,
			);

			const result = await service.resolveTournamentContext({
				explicitTournamentId: "tournament-2",
				selectedSlug: "world-cup-2026-demo",
			});

			expect(result.tournament.id).toBe("tournament-2");
			expect(result.source).toBe("explicit");
		});
	});

	describe("getStrictActiveTournament", () => {
		it("returns active tournament without context resolution", async () => {
			const prisma = createPrismaMock({
				tournaments: [createTournament()],
				matches: [],
			});
			const service = new TournamentsService(
				prisma as unknown as PrismaService,
			);

			const tournament = await service.getStrictActiveTournament();

			expect(tournament.status).toBe(TournamentStatus.ACTIVE);
		});
	});
});
