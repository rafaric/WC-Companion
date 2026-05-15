import 'reflect-metadata';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditResult {
  tournamentId: string;
  tournamentSlug: string;
  externalVenueReferences: {
    total: number;
    mismatched: number;
    details: Array<{
      referenceId: string;
      externalId: string;
      currentVenueId: string;
      currentVenueTournamentId: string;
      currentVenueName: string | null;
      expectedTournamentId: string;
      repairable: 'deterministic' | 'no-target';
    }>;
  };
  externalMatchReferences: {
    total: number;
    mismatched: number;
    details: Array<{
      referenceId: string;
      externalId: string;
      matchId: string;
      matchTournamentId: string;
      referenceTournamentId: string;
      homeTeamName: string;
      awayTeamName: string;
      kickoffAt: Date;
      repairable: 'deterministic' | 'multiple-candidates' | 'no-candidate';
    }>;
  };
  externalMatchResults: {
    total: number;
    withMatchId: number;
    matchIdMismatched: number;
    withoutMatchId: number;
    matchIdMismatchedDetails: Array<{
      resultId: string;
      externalMatchId: string;
      currentMatchId: string | null;
      currentMatchTournamentId: string | null;
      resultTournamentId: string;
      homeScore: number;
      awayScore: number;
      state: string;
      repairable: 'deterministic' | 'heuristic' | 'unrepairable';
    }>;
    withoutMatchIdDetails: Array<{
      resultId: string;
      externalMatchId: string;
      resultTournamentId: string;
      homeScore: number;
      awayScore: number;
      state: string;
      repairable: 'deterministic' | 'heuristic' | 'unrepairable';
    }>;
  };
  repairableSummary: {
    deterministic: { venueReferences: number; matchReferences: number; matchResults: number };
    heuristic: { matchResults: number };
    requiresManualReview: { venueReferencesNoTarget: number; matchReferencesMultiple: number; matchReferencesNoCandidate: number; matchResultsNoRef: number };
  };
}

type VenueReferenceRepairability = AuditResult['externalVenueReferences']['details'][number]['repairable'];
type MatchReferenceRepairability = AuditResult['externalMatchReferences']['details'][number]['repairable'];
type MatchResultRepairability = AuditResult['externalMatchResults']['matchIdMismatchedDetails'][number]['repairable'];

interface AuditFilters {
  providerKey: string | null;
}

async function auditVenueReferences(
  tournamentId: string,
  filters: AuditFilters,
): Promise<AuditResult['externalVenueReferences']> {
  const references = await prisma.externalVenueReference.findMany({
    where: {
      tournamentId,
      ...(filters.providerKey ? { providerKey: filters.providerKey } : {}),
    },
    select: {
      id: true,
      externalId: true,
      venueId: true,
      tournamentId: true,
      venue: {
        select: {
          id: true,
          name: true,
          tournamentId: true,
        },
      },
    },
  });

  const mismatched = references.filter((ref) => ref.venue.tournamentId !== ref.tournamentId);

  // Check each mismatched ref for repairability
  const details = await Promise.all(
    mismatched.map(async (ref) => {
      const targetExists = await prisma.venue.findFirst({
        where: { tournamentId: ref.tournamentId, name: ref.venue.name },
        select: { id: true },
      });
      const repairable: VenueReferenceRepairability = targetExists ? 'deterministic' : 'no-target';
      return {
        referenceId: ref.id,
        externalId: ref.externalId,
        currentVenueId: ref.venueId,
        currentVenueTournamentId: ref.venue.tournamentId,
        currentVenueName: ref.venue.name,
        expectedTournamentId: ref.tournamentId,
        repairable,
      };
    }),
  );

  return {
    total: references.length,
    mismatched: mismatched.length,
    details,
  };
}

async function auditMatchReferences(
  tournamentId: string,
  filters: AuditFilters,
): Promise<AuditResult['externalMatchReferences']> {
  const references = await prisma.externalMatchReference.findMany({
    where: {
      tournamentId,
      ...(filters.providerKey ? { providerKey: filters.providerKey } : {}),
    },
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

  const mismatched = references.filter((ref) => ref.match.tournamentId !== ref.tournamentId);

  const windowMs = 5 * 60 * 1000;
  const details = await Promise.all(
    mismatched.map(async (ref) => {
      const candidates = await prisma.match.findMany({
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

      let repairable: MatchReferenceRepairability;
      if (candidates.length === 0) repairable = 'no-candidate';
      else if (candidates.length > 1) repairable = 'multiple-candidates';
      else repairable = 'deterministic';

      return {
        referenceId: ref.id,
        externalId: ref.externalId,
        matchId: ref.matchId,
        matchTournamentId: ref.match.tournamentId,
        referenceTournamentId: ref.tournamentId,
        homeTeamName: ref.match.homeTeam.name,
        awayTeamName: ref.match.awayTeam.name,
        kickoffAt: ref.match.kickoffAt,
        repairable,
      };
    }),
  );

  return {
    total: references.length,
    mismatched: mismatched.length,
    details,
  };
}

async function auditMatchResults(
  tournamentId: string,
  filters: AuditFilters,
): Promise<AuditResult['externalMatchResults']> {
  const results = await prisma.externalMatchResult.findMany({
    where: {
      tournamentId,
      ...(filters.providerKey ? { providerKey: filters.providerKey } : {}),
    },
    select: {
      id: true,
      providerKey: true,
      externalMatchId: true,
      matchId: true,
      tournamentId: true,
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

  const withMatchId = results.filter((r) => r.matchId !== null);
  const withoutMatchId = results.filter((r) => r.matchId === null);
  const matchIdMismatched = withMatchId.filter((r) => r.match !== null && r.match.tournamentId !== r.tournamentId);

  const mismatchedDetails = await Promise.all(
    matchIdMismatched.map(async (r) => {
      const refWhere = { externalId: r.externalMatchId, match: { tournamentId: r.tournamentId } };
      const candidateRefs = await prisma.externalMatchReference.findMany({
        where: { ...refWhere, providerKey: r.providerKey },
        select: { id: true, matchId: true },
      });

      let repairable: MatchResultRepairability;
      if (candidateRefs.length === 0) repairable = 'unrepairable';
      else if (candidateRefs.length > 1) repairable = 'heuristic';
      else repairable = 'deterministic';

      return {
        resultId: r.id,
        externalMatchId: r.externalMatchId,
        currentMatchId: r.matchId,
        currentMatchTournamentId: r.match?.tournamentId ?? null,
        resultTournamentId: r.tournamentId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        state: r.state,
        repairable,
      };
    }),
  );

  const withoutMatchIdDetails = await Promise.all(
    withoutMatchId.map(async (r) => {
      const candidateRefs = await prisma.externalMatchReference.findMany({
        where: { externalId: r.externalMatchId, providerKey: r.providerKey, match: { tournamentId: r.tournamentId } },
        select: { id: true, matchId: true },
      });

      let repairable: MatchResultRepairability;
      if (candidateRefs.length === 0) repairable = 'unrepairable';
      else if (candidateRefs.length > 1) repairable = 'heuristic';
      else repairable = 'deterministic';

      return {
        resultId: r.id,
        externalMatchId: r.externalMatchId,
        resultTournamentId: r.tournamentId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        state: r.state,
        repairable,
      };
    }),
  );

  return {
    total: results.length,
    withMatchId: withMatchId.length,
    matchIdMismatched: matchIdMismatched.length,
    withoutMatchId: withoutMatchId.length,
    matchIdMismatchedDetails: mismatchedDetails,
    withoutMatchIdDetails: withoutMatchIdDetails,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let targetTournamentId: string | null = null;
  let targetProvider: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tournament-id' && i + 1 < args.length) {
      const value = args[++i];
      targetTournamentId = value ?? null;
    } else if (args[i] === '--provider' && i + 1 < args.length) {
      const value = args[++i];
      targetProvider = value ?? null;
    }
  }

  const tournamentFilter = targetTournamentId
    ? await prisma.tournament.findMany({ where: { id: targetTournamentId }, select: { id: true, slug: true, name: true } })
    : await prisma.tournament.findMany({ select: { id: true, slug: true, name: true } });

  if (tournamentFilter.length === 0 && targetTournamentId) {
    console.error(`Tournament ${targetTournamentId} not found`);
    process.exitCode = 1;
    return;
  }

  if (targetTournamentId) console.error(`Targeting tournament: ${targetTournamentId}`);
  if (targetProvider) console.error(`Filtering by provider: ${targetProvider}`);
  console.error('');

  const overall: AuditResult = {
    tournamentId: '',
    tournamentSlug: '',
    externalVenueReferences: { total: 0, mismatched: 0, details: [] },
    externalMatchReferences: { total: 0, mismatched: 0, details: [] },
    externalMatchResults: {
      total: 0,
      withMatchId: 0,
      matchIdMismatched: 0,
      withoutMatchId: 0,
      matchIdMismatchedDetails: [],
      withoutMatchIdDetails: [],
    },
    repairableSummary: {
      deterministic: { venueReferences: 0, matchReferences: 0, matchResults: 0 },
      heuristic: { matchResults: 0 },
      requiresManualReview: { venueReferencesNoTarget: 0, matchReferencesMultiple: 0, matchReferencesNoCandidate: 0, matchResultsNoRef: 0 },
    },
  };

  const filters: AuditFilters = {
    providerKey: targetProvider,
  };

  for (const tournament of tournamentFilter) {
    const [venueRefs, matchRefs, matchResults] = await Promise.all([
      auditVenueReferences(tournament.id, filters),
      auditMatchReferences(tournament.id, filters),
      auditMatchResults(tournament.id, filters),
    ]);

    // Aggregate totals
    overall.externalVenueReferences.total += venueRefs.total;
    overall.externalVenueReferences.mismatched += venueRefs.mismatched;
    overall.externalMatchReferences.total += matchRefs.total;
    overall.externalMatchReferences.mismatched += matchRefs.mismatched;
    overall.externalMatchResults.total += matchResults.total;
    overall.externalMatchResults.withMatchId += matchResults.withMatchId;
    overall.externalMatchResults.matchIdMismatched += matchResults.matchIdMismatched;
    overall.externalMatchResults.withoutMatchId += matchResults.withoutMatchId;

    // Tally repairable categories
    for (const d of venueRefs.details) {
      if (d.repairable === 'deterministic') overall.repairableSummary.deterministic.venueReferences++;
      else overall.repairableSummary.requiresManualReview.venueReferencesNoTarget++;
    }
    for (const d of matchRefs.details) {
      if (d.repairable === 'deterministic') overall.repairableSummary.deterministic.matchReferences++;
      else if (d.repairable === 'multiple-candidates') overall.repairableSummary.requiresManualReview.matchReferencesMultiple++;
      else overall.repairableSummary.requiresManualReview.matchReferencesNoCandidate++;
    }
    for (const d of matchResults.matchIdMismatchedDetails) {
      if (d.repairable === 'deterministic') overall.repairableSummary.deterministic.matchResults++;
      else if (d.repairable === 'heuristic') overall.repairableSummary.heuristic.matchResults++;
      else overall.repairableSummary.requiresManualReview.matchResultsNoRef++;
    }
    for (const d of matchResults.withoutMatchIdDetails) {
      if (d.repairable === 'deterministic') overall.repairableSummary.deterministic.matchResults++;
      else if (d.repairable === 'heuristic') overall.repairableSummary.heuristic.matchResults++;
      else overall.repairableSummary.requiresManualReview.matchResultsNoRef++;
    }

    // Print per-tournament summary
    const hasIssues = venueRefs.mismatched > 0 || matchRefs.mismatched > 0 || matchResults.matchIdMismatched > 0 || matchResults.withoutMatchId > 0;
    if (hasIssues) {
      console.error(`\n=== Tournament: ${tournament.name} (${tournament.slug}) ===`);
      console.error(`  ExternalVenueReferences: ${venueRefs.mismatched}/${venueRefs.total} mismatched`);
      const venueDet = venueRefs.details.filter((d) => d.repairable === 'deterministic');
      const venueNoTarget = venueRefs.details.filter((d) => d.repairable === 'no-target');
      if (venueDet.length > 0) {
        console.error(`    [deterministic repair] ${venueDet.length} — repair will update venue reference to existing venue in target tournament`);
      }
      if (venueNoTarget.length > 0) {
        console.error(`    [requires manual review] ${venueNoTarget.length} — no venue with matching name in target tournament`);
        for (const detail of venueNoTarget.slice(0, 3)) {
          console.error(`      - ref=${detail.referenceId} externalId=${detail.externalId} venue="${detail.currentVenueName}" (tournament ${detail.currentVenueTournamentId}) → needs manual venue creation in tournament ${detail.expectedTournamentId}`);
        }
        if (venueNoTarget.length > 3) console.error(`      ... and ${venueNoTarget.length - 3} more`);
      }

      console.error(`  ExternalMatchReferences: ${matchRefs.mismatched}/${matchRefs.total} mismatched`);
      const matchDet = matchRefs.details.filter((d) => d.repairable === 'deterministic');
      const matchMulti = matchRefs.details.filter((d) => d.repairable === 'multiple-candidates');
      const matchNone = matchRefs.details.filter((d) => d.repairable === 'no-candidate');
      if (matchDet.length > 0) console.error(`    [deterministic repair] ${matchDet.length}`);
      if (matchMulti.length > 0) {
        console.error(`    [requires manual review] ${matchMulti.length} — multiple candidate matches, cannot auto-disambiguate`);
        for (const detail of matchMulti.slice(0, 3)) {
          console.error(`      - ref=${detail.referenceId} externalId=${detail.externalId}: ${detail.homeTeamName} vs ${detail.awayTeamName} at ${detail.kickoffAt.toISOString()}`);
        }
        if (matchMulti.length > 3) console.error(`      ... and ${matchMulti.length - 3} more`);
      }
      if (matchNone.length > 0) {
        console.error(`    [requires manual review] ${matchNone.length} — no candidate match found in target tournament`);
        for (const detail of matchNone.slice(0, 3)) {
          console.error(`      - ref=${detail.referenceId} externalId=${detail.externalId}: ${detail.homeTeamName} vs ${detail.awayTeamName} at ${detail.kickoffAt.toISOString()}`);
        }
        if (matchNone.length > 3) console.error(`      ... and ${matchNone.length - 3} more`);
      }

      console.error(`  ExternalMatchResults: ${matchResults.matchIdMismatched} mismatched, ${matchResults.withoutMatchId} without matchId`);
      const mismatchedDet = matchResults.matchIdMismatchedDetails.filter((d) => d.repairable === 'deterministic');
      const mismatchedHeur = matchResults.matchIdMismatchedDetails.filter((d) => d.repairable === 'heuristic');
      const mismatchedUnr = matchResults.matchIdMismatchedDetails.filter((d) => d.repairable === 'unrepairable');
      const noIdDet = matchResults.withoutMatchIdDetails.filter((d) => d.repairable === 'deterministic');
      const noIdHeur = matchResults.withoutMatchIdDetails.filter((d) => d.repairable === 'heuristic');
      const noIdUnr = matchResults.withoutMatchIdDetails.filter((d) => d.repairable === 'unrepairable');

      if (mismatchedDet.length > 0) console.error(`    [deterministic repair] ${mismatchedDet.length} mismatched results with exactly one reference candidate`);
      if (mismatchedHeur.length > 0) console.error(`    [heuristic — caution] ${mismatchedHeur.length} mismatched results have multiple reference candidates, auto-repair would be ambiguous`);
      if (mismatchedUnr.length > 0) console.error(`    [requires manual review] ${mismatchedUnr.length} mismatched results have no reference in target tournament`);
      if (noIdDet.length > 0) console.error(`    [deterministic repair] ${noIdDet.length} no-matchId results with exactly one reference candidate`);
      if (noIdHeur.length > 0) console.error(`    [heuristic — caution] ${noIdHeur.length} no-matchId results have multiple reference candidates`);
      if (noIdUnr.length > 0) console.error(`    [requires manual review] ${noIdUnr.length} no-matchId results have no reference in target tournament`);
    }
  }

  // Summary to stdout as JSON
  console.log(JSON.stringify(overall, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
