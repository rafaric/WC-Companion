import { MatchStatus, PrismaClient, TournamentStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

interface TeamSeed {
  name: string;
  shortName: string;
  countryCode: string;
  flagCode: string;
  primaryColor?: string;
  secondaryColor?: string;
}

interface MatchSeed {
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: Date;
  stage: string;
  groupName: string;
}

const prisma = new PrismaClient();
type SeedClient = PrismaClient | Prisma.TransactionClient;

const TOURNAMENT = {
  name: 'World Cup 2026 Demo',
  slug: 'world-cup-2026-demo',
  year: 2026,
  status: TournamentStatus.ACTIVE,
} as const;

const TEAM_SEEDS = [
  {
    name: 'Argentina',
    shortName: 'ARG',
    countryCode: 'AR',
    flagCode: 'ARG',
    primaryColor: '#74ACDF',
    secondaryColor: '#F6E7A1',
  },
  {
    name: 'Uruguay',
    shortName: 'URU',
    countryCode: 'UY',
    flagCode: 'URU',
    primaryColor: '#5DADE2',
    secondaryColor: '#FDFEFE',
  },
  {
    name: 'Brazil',
    shortName: 'BRA',
    countryCode: 'BR',
    flagCode: 'BRA',
    primaryColor: '#009C3B',
    secondaryColor: '#FFDF00',
  },
  {
    name: 'France',
    shortName: 'FRA',
    countryCode: 'FR',
    flagCode: 'FRA',
    primaryColor: '#002654',
    secondaryColor: '#ED2939',
  },
  {
    name: 'Spain',
    shortName: 'ESP',
    countryCode: 'ES',
    flagCode: 'ESP',
    primaryColor: '#AA151B',
    secondaryColor: '#F1BF00',
  },
  {
    name: 'Germany',
    shortName: 'GER',
    countryCode: 'DE',
    flagCode: 'GER',
    primaryColor: '#000000',
    secondaryColor: '#DD0000',
  },
  {
    name: 'England',
    shortName: 'ENG',
    countryCode: 'GB-ENG',
    flagCode: 'ENG',
    primaryColor: '#FFFFFF',
    secondaryColor: '#CE1124',
  },
  {
    name: 'Portugal',
    shortName: 'POR',
    countryCode: 'PT',
    flagCode: 'POR',
    primaryColor: '#006600',
    secondaryColor: '#FF0000',
  },
] satisfies readonly TeamSeed[];

const MATCH_SEEDS = [
  {
    homeTeamName: 'Argentina',
    awayTeamName: 'England',
    kickoffAt: new Date(Date.UTC(2026, 5, 11, 16, 0, 0)),
    stage: 'Group Stage',
    groupName: 'Group A',
  },
  {
    homeTeamName: 'Brazil',
    awayTeamName: 'Germany',
    kickoffAt: new Date(Date.UTC(2026, 5, 12, 16, 0, 0)),
    stage: 'Group Stage',
    groupName: 'Group B',
  },
  {
    homeTeamName: 'France',
    awayTeamName: 'Portugal',
    kickoffAt: new Date(Date.UTC(2026, 5, 13, 18, 0, 0)),
    stage: 'Group Stage',
    groupName: 'Group C',
  },
  {
    homeTeamName: 'Spain',
    awayTeamName: 'Uruguay',
    kickoffAt: new Date(Date.UTC(2026, 5, 14, 18, 0, 0)),
    stage: 'Group Stage',
    groupName: 'Group D',
  },
] satisfies readonly MatchSeed[];

const DEFAULT_SCORING_RULE = {
  name: 'Default 3-1-0',
  exactScore: 3,
  correctSide: 1,
  wrongResult: 0,
} as const;

async function upsertTournament(client: SeedClient) {
  return client.tournament.upsert({
    where: { slug: TOURNAMENT.slug },
    create: TOURNAMENT,
    update: {
      name: TOURNAMENT.name,
      year: TOURNAMENT.year,
      status: TOURNAMENT.status,
    },
  });
}

async function upsertTeam(client: SeedClient, tournamentId: string, team: TeamSeed) {
  return client.team.upsert({
    where: {
      tournamentId_name: {
        tournamentId,
        name: team.name,
      },
    },
    create: {
      tournamentId,
      ...team,
    },
    update: {
      shortName: team.shortName,
      countryCode: team.countryCode,
      flagCode: team.flagCode,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
    },
  });
}

async function upsertScoringRule(client: SeedClient, tournamentId: string) {
  const scoringRule = await client.scoringRule.findFirst({
    where: {
      tournamentId,
      name: DEFAULT_SCORING_RULE.name,
    },
    orderBy: { createdAt: 'asc' },
  });

  const activeRule = scoringRule
    ? await client.scoringRule.update({
        where: { id: scoringRule.id },
        data: {
          exactScore: DEFAULT_SCORING_RULE.exactScore,
          correctSide: DEFAULT_SCORING_RULE.correctSide,
          wrongResult: DEFAULT_SCORING_RULE.wrongResult,
          isActive: true,
        },
      })
    : await client.scoringRule.create({
        data: {
          tournamentId,
          name: DEFAULT_SCORING_RULE.name,
          exactScore: DEFAULT_SCORING_RULE.exactScore,
          correctSide: DEFAULT_SCORING_RULE.correctSide,
          wrongResult: DEFAULT_SCORING_RULE.wrongResult,
          isActive: true,
        },
      });

  await client.scoringRule.updateMany({
    where: {
      tournamentId,
      NOT: { id: activeRule.id },
    },
    data: { isActive: false },
  });

  return activeRule;
}

async function upsertMatch(
  client: SeedClient,
  tournamentId: string,
  teamIdsByName: Map<string, string>,
  match: MatchSeed,
) {
  const homeTeamId = teamIdsByName.get(match.homeTeamName);
  const awayTeamId = teamIdsByName.get(match.awayTeamName);

  if (!homeTeamId || !awayTeamId) {
    throw new Error(`Missing team ids for match ${match.homeTeamName} vs ${match.awayTeamName}`);
  }

  const existingMatch = await client.match.findFirst({
    where: {
      tournamentId,
      homeTeamId,
      awayTeamId,
      kickoffAt: match.kickoffAt,
      stage: match.stage,
      groupName: match.groupName,
    },
  });

  if (existingMatch) {
    return client.match.update({
      where: { id: existingMatch.id },
      data: {
        kickoffAt: match.kickoffAt,
        stage: match.stage,
        groupName: match.groupName,
        status: MatchStatus.UPCOMING,
        homeScore: null,
        awayScore: null,
        finalizedAt: null,
      },
    });
  }

  return client.match.create({
    data: {
      tournamentId,
      homeTeamId,
      awayTeamId,
      kickoffAt: match.kickoffAt,
      stage: match.stage,
      groupName: match.groupName,
      status: MatchStatus.UPCOMING,
    },
  });
}

async function main() {
  const tournament = await prisma.$transaction(async (transaction) => {
    const createdTournament = await upsertTournament(transaction);

    const teams = [] as Awaited<ReturnType<typeof upsertTeam>>[];

    for (const team of TEAM_SEEDS) {
      teams.push(await upsertTeam(transaction, createdTournament.id, team));
    }

    const teamIdsByName = new Map(teams.map((team) => [team.name, team.id] as const));

    await upsertScoringRule(transaction, createdTournament.id);

    for (const match of MATCH_SEEDS) {
      await upsertMatch(transaction, createdTournament.id, teamIdsByName, match);
    }

    return createdTournament;
  });

  console.log(`Seeded tournament: ${tournament.name}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
