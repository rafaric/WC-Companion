import 'reflect-metadata';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RepairSummary {
  total: number;
  matchIdAlreadyCorrect: number;
  matchIdRepaired: number;
  matchIdBackfilled: number;
  unrepairable: number;
  unrepairableDetails: string[];
  errors: string[];
  mutationTargets: string[];
  skipped: {
    confirmedRows: number;
    noMatchInTargetTournament: number;
  };
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  tournamentId: string | null;
  provider: string | null;
  allowConfirmed: boolean;
} {
  const result = { dryRun: false, tournamentId: null as string | null, provider: null as string | null, allowConfirmed: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--tournament-id' && i + 1 < argv.length) {
      result.tournamentId = argv[++i];
    } else if (arg === '--provider' && i + 1 < argv.length) {
      result.provider = argv[++i];
    } else if (arg === '--allow-confirmed') {
      result.allowConfirmed = true;
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { dryRun, tournamentId, provider, allowConfirmed } = args;

  if (dryRun) {
    console.error('Running in DRY-RUN mode — no changes will be persisted');
  }

  const summary: RepairSummary = {
    total: 0,
    matchIdAlreadyCorrect: 0,
    matchIdRepaired: 0,
    matchIdBackfilled: 0,
    unrepairable: 0,
    unrepairableDetails: [],
    errors: [],
    mutationTargets: [],
    skipped: { confirmedRows: 0, noMatchInTargetTournament: 0 },
  };

  const whereClause: Parameters<typeof prisma.externalMatchResult.findMany>[0]['where'] = {};
  if (!allowConfirmed) {
    whereClause.state = { not: 'CONFIRMED' };
  }
  if (tournamentId) whereClause.tournamentId = tournamentId;
  if (provider) whereClause.providerKey = provider;

  const results = await prisma.externalMatchResult.findMany({
    where: whereClause,
    select: {
      id: true,
      providerKey: true,
      externalMatchId: true,
      tournamentId: true,
      matchId: true,
      homeScore: true,
      awayScore: true,
      state: true,
      match: {
        select: {
          id: true,
          tournamentId: true,
        },
      },
    },
  });

  if (tournamentId) {
    console.error(`Targeting tournament: ${tournamentId}`);
  }
  if (provider) {
    console.error(`Filtering by provider: ${provider}`);
  }
  if (!allowConfirmed) {
    console.error('Excluding CONFIRMED rows (use --allow-confirmed to process them)');
  }
  console.error(`Found ${results.length} result(s) to evaluate\n`);

  for (const result of results) {
    summary.total++;

    if (result.matchId === null) {
      // No matchId — try to backfill via ExternalMatchReference in correct tournament
      const refWhere: Parameters<typeof prisma.externalMatchReference.findFirst>[0]['where'] = {
        providerKey: result.providerKey,
        externalId: result.externalMatchId,
        match: { tournamentId: result.tournamentId },
      };
      const correctRef = await prisma.externalMatchReference.findFirst({
        where: refWhere,
        select: { matchId: true },
      });

      if (correctRef) {
        summary.matchIdBackfilled++;
        summary.mutationTargets.push(`result=${result.id} externalMatchId=${result.externalMatchId} → backfill matchId=${correctRef.matchId}`);
        if (!dryRun) {
          await prisma.externalMatchResult.update({
            where: { id: result.id },
            data: { matchId: correctRef.matchId },
          });
        }
      } else {
        summary.unrepairable++;
        summary.unrepairableDetails.push(
          `result=${result.id} externalMatchId=${result.externalMatchId} provider=${result.providerKey}: no ExternalMatchReference found in tournament ${result.tournamentId}`,
        );
      }
      continue;
    }

    // matchId is set — check if it's in the correct tournament
    if (result.match !== null && result.match.tournamentId === result.tournamentId) {
      summary.matchIdAlreadyCorrect++;
      continue;
    }

    // Mismatched — try to find correct reference
    const refWhere: Parameters<typeof prisma.externalMatchReference.findFirst>[0]['where'] = {
      providerKey: result.providerKey,
      externalId: result.externalMatchId,
      match: { tournamentId: result.tournamentId },
    };
    const correctRef = await prisma.externalMatchReference.findFirst({
      where: refWhere,
      select: { matchId: true },
    });

    if (correctRef) {
      summary.matchIdRepaired++;
      summary.mutationTargets.push(`result=${result.id} externalMatchId=${result.externalMatchId} → repair matchId=${correctRef.matchId} (was ${result.matchId})`);
      if (!dryRun) {
        await prisma.externalMatchResult.update({
          where: { id: result.id },
          data: { matchId: correctRef.matchId },
        });
      }
    } else {
      summary.unrepairable++;
      summary.unrepairableDetails.push(
        `result=${result.id} externalMatchId=${result.externalMatchId} provider=${result.providerKey}: match=${result.matchId} belongs to wrong tournament, but no correct ExternalMatchReference found in tournament ${result.tournamentId}`,
      );
    }
  }

  // Emit清晰的mutations报告
  if (summary.mutationTargets.length > 0) {
    console.error('=== Mutations planned ===');
    for (const m of summary.mutationTargets) {
      console.error(`  ${dryRun ? '[DRYRUN] ' : ''}${m}`);
    }
    console.error('');
  }

  const output = {
    dryRun,
    allowConfirmed,
    targeting: { tournamentId, provider },
    total: summary.total,
    matchIdAlreadyCorrect: summary.matchIdAlreadyCorrect,
    matchIdRepaired: summary.matchIdRepaired,
    matchIdBackfilled: summary.matchIdBackfilled,
    unrepairable: summary.unrepairable,
    unrepairableDetails: summary.unrepairableDetails,
    errors: summary.errors,
  };

  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });