import 'reflect-metadata';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RepairSummary {
  venueReferences: {
    total: number;
    repaired: number;
    skippedNoTarget: number;
    failed: number;
    skippedNoTargetDetails: string[];
    errors: string[];
  };
  matchReferences: {
    total: number;
    repaired: number;
    skippedNoCandidate: number;
    skippedMultipleCandidates: number;
    failed: number;
    skippedNoCandidateDetails: string[];
    skippedMultipleCandidatesDetails: string[];
    errors: string[];
  };
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  tournamentId: string | null;
  provider: string | null;
} {
  const result = { dryRun: false, tournamentId: null as string | null, provider: null as string | null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--tournament-id' && i + 1 < argv.length) {
      result.tournamentId = argv[++i];
    } else if (arg === '--provider' && i + 1 < argv.length) {
      result.provider = argv[++i];
    }
  }
  return result;
}

async function repairVenueReference(
  ref: {
    id: string;
    externalId: string;
    venueId: string;
    tournamentId: string;
    venue: { id: string; name: string; tournamentId: string };
  },
  dryRun: boolean,
): Promise<'repaired' | 'skipped-no-target'> {
  // Find a venue in the correct tournament with the same name
  const targetVenue = await prisma.venue.findFirst({
    where: {
      tournamentId: ref.tournamentId,
      name: ref.venue.name,
    },
    select: { id: true },
  });

  if (!targetVenue) {
    // No venue with matching name in target tournament — skip and require manual review.
    // Auto-creation was removed: creating venues without confirmation risks data corruption.
    return 'skipped-no-target';
  }

  if (dryRun) {
    return 'repaired';
  }

  await prisma.externalVenueReference.update({
    where: { id: ref.id },
    data: { venueId: targetVenue.id },
  });
  return 'repaired';
}

async function repairMatchReference(
  ref: {
    id: string;
    externalId: string;
    matchId: string;
    tournamentId: string;
    match: {
      id: string;
      tournamentId: string;
      kickoffAt: Date;
      homeTeam: { name: string };
      awayTeam: { name: string };
    };
  },
  dryRun: boolean,
): Promise<'repaired' | 'skipped-no-candidate' | 'skipped-multiple-candidates'> {
  // Find a match in the correct tournament with the same home team name,
  // away team name, and kickoffAt (within a 5-minute window to account for
  // minor clock skew from the provider).
  const windowMs = 5 * 60 * 1000;
  const matches = await prisma.match.findMany({
    where: {
      tournamentId: ref.tournamentId,
      homeTeam: { name: ref.match.homeTeam.name },
      awayTeam: { name: ref.match.awayTeam.name },
      kickoffAt: {
        gte: new Date(ref.match.kickoffAt.getTime() - windowMs),
        lte: new Date(ref.match.kickoffAt.getTime() + windowMs),
      },
    },
    select: { id: true },
  });

  if (matches.length === 0) {
    return 'skipped-no-candidate';
  }

  if (matches.length > 1) {
    return 'skipped-multiple-candidates';
  }

  if (dryRun) {
    return 'repaired';
  }

  await prisma.externalMatchReference.update({
    where: { id: ref.id },
    data: { matchId: matches[0].id },
  });
  return 'repaired';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { dryRun, tournamentId, provider } = args;

  if (dryRun) {
    console.error('Running in DRY-RUN mode — no changes will be persisted');
  }

  const summary: RepairSummary = {
    venueReferences: { total: 0, repaired: 0, skippedNoTarget: 0, failed: 0, skippedNoTargetDetails: [], errors: [] },
    matchReferences: {
      total: 0,
      repaired: 0,
      skippedNoCandidate: 0,
      skippedMultipleCandidates: 0,
      failed: 0,
      skippedNoCandidateDetails: [],
      skippedMultipleCandidatesDetails: [],
      errors: [],
    },
  };

  // Build where clauses for optional targeting
  const venueWhere: Parameters<typeof prisma.externalVenueReference.findMany>[0]['where'] = {};
  const matchWhere: Parameters<typeof prisma.externalMatchReference.findMany>[0]['where'] = {};
  if (tournamentId) {
    venueWhere.tournamentId = tournamentId;
    matchWhere.tournamentId = tournamentId;
  }
  if (provider) {
    venueWhere.providerKey = provider;
    matchWhere.providerKey = provider;
  }

  // --- Repair ExternalVenueReference ---
  const allVenueRefs = await prisma.externalVenueReference.findMany({
    where: venueWhere,
    select: {
      id: true,
      externalId: true,
      venueId: true,
      tournamentId: true,
      venue: { select: { id: true, name: true, tournamentId: true } },
    },
  });

  if (tournamentId) console.error(`Targeting tournament: ${tournamentId}`);
  if (provider) console.error(`Filtering by provider: ${provider}`);
  console.error(`Evaluating ${allVenueRefs.length} venue reference(s)\n`);

  for (const ref of allVenueRefs) {
    if (ref.venue.tournamentId === ref.tournamentId) {
      continue; // correctly scoped, no repair needed
    }
    summary.venueReferences.total++;
    try {
      const result = await repairVenueReference(ref, dryRun);
      if (result === 'repaired') {
        summary.venueReferences.repaired++;
        console.error(`[VENUE] ${dryRun ? '[DRYRUN] ' : ''}repaired ref=${ref.id} externalId=${ref.externalId} venue="${ref.venue.name}" → tournament ${ref.tournamentId}`);
      } else {
        summary.venueReferences.skippedNoTarget++;
        summary.venueReferences.skippedNoTargetDetails.push(
          `venue ref ${ref.id} (externalId=${ref.externalId}): no venue named "${ref.venue.name}" exists in tournament ${ref.tournamentId}`,
        );
      }
    } catch (err) {
      summary.venueReferences.failed++;
      summary.venueReferences.errors.push(
        `venue ref ${ref.id} (externalId=${ref.externalId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // --- Repair ExternalMatchReference ---
  const allMatchRefs = await prisma.externalMatchReference.findMany({
    where: matchWhere,
    select: {
      id: true,
      externalId: true,
      matchId: true,
      tournamentId: true,
      match: {
        select: {
          id: true,
          tournamentId: true,
          kickoffAt: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      },
    },
  });

  console.error(`Evaluating ${allMatchRefs.length} match reference(s)\n`);

  for (const ref of allMatchRefs) {
    if (ref.match.tournamentId === ref.tournamentId) {
      continue; // correctly scoped, no repair needed
    }
    summary.matchReferences.total++;
    try {
      const result = await repairMatchReference(ref, dryRun);
      if (result === 'repaired') {
        summary.matchReferences.repaired++;
        console.error(
          `[MATCH] ${dryRun ? '[DRYRUN] ' : ''}repaired ref=${ref.id} externalId=${ref.externalId} ${ref.match.homeTeam.name} vs ${ref.match.awayTeam.name} → tournament ${ref.tournamentId}`,
        );
      } else if (result === 'skipped-no-candidate') {
        summary.matchReferences.skippedNoCandidate++;
        summary.matchReferences.skippedNoCandidateDetails.push(
          `match ref ${ref.id} (externalId=${ref.externalId}): no match found for ${ref.match.homeTeam.name} vs ${ref.match.awayTeam.name} at ${ref.match.kickoffAt.toISOString()} in tournament ${ref.tournamentId}`,
        );
      } else if (result === 'skipped-multiple-candidates') {
        summary.matchReferences.skippedMultipleCandidates++;
        summary.matchReferences.skippedMultipleCandidatesDetails.push(
          `match ref ${ref.id} (externalId=${ref.externalId}): multiple candidate matches for ${ref.match.homeTeam.name} vs ${ref.match.awayTeam.name} at ${ref.match.kickoffAt.toISOString()} in tournament ${ref.tournamentId} — requires manual disambiguation`,
        );
      }
    } catch (err) {
      summary.matchReferences.failed++;
      summary.matchReferences.errors.push(
        `match ref ${ref.id} (externalId=${ref.externalId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const output = {
    dryRun,
    targeting: { tournamentId, provider },
    venueReferences: {
      total: summary.venueReferences.total,
      repaired: summary.venueReferences.repaired,
      skippedNoTarget: summary.venueReferences.skippedNoTarget,
      failed: summary.venueReferences.failed,
      skippedNoTargetDetails: summary.venueReferences.skippedNoTargetDetails,
      errors: summary.venueReferences.errors,
    },
    matchReferences: {
      total: summary.matchReferences.total,
      repaired: summary.matchReferences.repaired,
      skippedNoCandidate: summary.matchReferences.skippedNoCandidate,
      skippedMultipleCandidates: summary.matchReferences.skippedMultipleCandidates,
      failed: summary.matchReferences.failed,
      skippedNoCandidateDetails: summary.matchReferences.skippedNoCandidateDetails,
      skippedMultipleCandidatesDetails: summary.matchReferences.skippedMultipleCandidatesDetails,
      errors: summary.matchReferences.errors,
    },
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