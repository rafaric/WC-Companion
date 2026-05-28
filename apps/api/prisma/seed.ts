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

/**
 * Seed Data Separation Strategy (PR3)
 *
 * This seed creates two distinct tournament contexts:
 *
 * 1. DEMO TOURNAMENT (world-cup-2026-demo)
 *    - Status: FINISHED (non-ACTIVE)
 *    - Purpose: Manual/demo data for selector testing
 *    - Fixtures: Preserved under demo slug for preview
 *
 * 2. PROVIDER-BACKED TOURNAMENT (world-cup-2026)
 *    - Status: ACTIVE (the fallback for all reads)
 *    - Purpose: Real tournament data (future: provider sync target)
 *    - Fixtures: Empty initially (ready for provider import)
 *
 * 3. LIGA ARGENTINA TOURNAMENT (liga-argentina-2026)
 *    - Status: DRAFT (selectable, but not the default fallback)
 *    - Purpose: LPF website provider sync target
 *    - Fixtures: Empty initially (ready for lpf-web provider import)
 *
 * The selector exposes all tournaments, but only the ACTIVE tournament
 * serves as the deterministic fallback. This ensures:
 * - Demo data remains available for preview without being the sync target
 * - Provider sync operations target the ACTIVE tournament
 * - No ambiguity in fallback behavior
 */

// Demo tournament: manual/demo data for selector testing
const DEMO_TOURNAMENT = {
  name: 'World Cup 2026 Demo',
  slug: 'world-cup-2026-demo',
  year: 2026,
  status: TournamentStatus.FINISHED,
  startsAt: new Date(Date.UTC(2026, 5, 11)),
  endsAt: new Date(Date.UTC(2026, 5, 25)),
} as const;

// Provider-backed tournament: the ACTIVE fallback for real operations
const PROVIDER_TOURNAMENT = {
  name: 'World Cup 2026',
  slug: 'world-cup-2026',
  year: 2026,
  status: TournamentStatus.ACTIVE,
  startsAt: new Date(Date.UTC(2026, 5, 11)),
  endsAt: new Date(Date.UTC(2026, 5, 25)),
} as const;

const LIGA_ARGENTINA_TOURNAMENT = {
  name: 'Liga Argentina 2026',
  slug: 'liga-argentina-2026',
  year: 2026,
  status: TournamentStatus.DRAFT,
  startsAt: new Date(Date.UTC(2026, 0, 22)),
  endsAt: new Date(Date.UTC(2026, 11, 31)),
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

/**
 * Upsert a tournament by slug, updating key fields while preserving the record.
 */
async function upsertTournament(
  client: SeedClient,
  tournament: typeof DEMO_TOURNAMENT | typeof PROVIDER_TOURNAMENT | typeof LIGA_ARGENTINA_TOURNAMENT,
) {
  return client.tournament.upsert({
    where: { slug: tournament.slug },
    create: tournament,
    update: {
      name: tournament.name,
      year: tournament.year,
      status: tournament.status,
      startsAt: tournament.startsAt,
      endsAt: tournament.endsAt,
    },
  });
}

/**
 * Validates that exactly one ACTIVE tournament exists after seeding.
 * This ensures deterministic fallback behavior per the design spec.
 */
async function validateSingleActiveTournament(client: SeedClient) {
  const activeTournaments = await client.tournament.findMany({
    where: { status: TournamentStatus.ACTIVE },
    select: { id: true, name: true, slug: true },
  });

  if (activeTournaments.length === 0) {
    throw new Error('Seed validation failed: no ACTIVE tournament exists. One tournament must be ACTIVE.');
  }

  if (activeTournaments.length > 1) {
    const names = activeTournaments.map((t) => t.name).join(', ');
    throw new Error(
      `Seed validation failed: multiple ACTIVE tournaments found (${names}). ` +
        'Only one tournament can be ACTIVE for deterministic fallback.',
    );
  }

  console.log(`✓ Validation passed: exactly one ACTIVE tournament (${activeTournaments[0].name})`);
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
  await prisma.$transaction(async (transaction) => {
    // Step 1: Seed the provider-backed tournament (ACTIVE - the fallback)
    const providerTournament = await upsertTournament(transaction, PROVIDER_TOURNAMENT);
    console.log(`✓ Seeded provider-backed tournament: ${providerTournament.name} (${providerTournament.status})`);

    // Step 2: Seed the Liga Argentina tournament (DRAFT - selectable sync target)
    const ligaTournament = await upsertTournament(transaction, LIGA_ARGENTINA_TOURNAMENT);
    console.log(`✓ Seeded Liga Argentina tournament: ${ligaTournament.name} (${ligaTournament.status})`);

    // Step 3: Seed the demo tournament (FINISHED - for selector testing)
    const demoTournament = await upsertTournament(transaction, DEMO_TOURNAMENT);
    console.log(`✓ Seeded demo tournament: ${demoTournament.name} (${demoTournament.status})`);

    // Step 4: Seed scoring rules for provider-backed tournaments.
    // They start without fixtures, but result confirmation still needs an active scoring rule.
    await upsertScoringRule(transaction, providerTournament.id);
    await upsertScoringRule(transaction, ligaTournament.id);

    // Step 5: Seed demo fixtures under demo tournament slug
    // (Provider tournaments start empty, ready for provider import)
    const teams = [] as Awaited<ReturnType<typeof upsertTeam>>[];

    for (const team of TEAM_SEEDS) {
      teams.push(await upsertTeam(transaction, demoTournament.id, team));
    }

    const teamIdsByName = new Map(teams.map((team) => [team.name, team.id] as const));

    await upsertScoringRule(transaction, demoTournament.id);

    for (const match of MATCH_SEEDS) {
      await upsertMatch(transaction, demoTournament.id, teamIdsByName, match);
    }

    console.log(`✓ Seeded ${teams.length} teams and ${MATCH_SEEDS.length} matches for demo tournament`);

    // Step 6: Validate exactly one ACTIVE tournament exists
    await validateSingleActiveTournament(transaction);

    console.log('\n=== Seed Summary ===');
    console.log(`Demo tournament: ${demoTournament.name} (${demoTournament.slug}) - ${demoTournament.status}`);
    console.log(`Provider tournament: ${providerTournament.name} (${providerTournament.slug}) - ${providerTournament.status}`);
    console.log(`Liga Argentina tournament: ${ligaTournament.name} (${ligaTournament.slug}) - ${ligaTournament.status}`);
    console.log('\nThe selector will show all seeded tournaments.');
    console.log('The ACTIVE tournament serves as the deterministic fallback.');
    console.log('Demo fixtures are preserved under the demo slug for preview.');
  }, { maxWait: 60000, timeout: 120000 });
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
