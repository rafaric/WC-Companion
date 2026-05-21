import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, TournamentStatus } from '@prisma/client';

import type { MatchesService, FinalizeMatchSummary } from '../matches/matches.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { TournamentsService, TournamentContextInput, ResolvedTournamentContext } from '../tournaments/tournaments.service';
import {
  EXTERNAL_MATCH_RESULT_STATES,
  type ExternalMatchResultState,
  SPORTS_DATA_PROVIDER,
  SPORTS_DATA_PROVIDER_KEYS,
  SPORTS_DATA_SYNC_STATUSES,
  SPORTS_DATA_SYNC_TYPES,
  type SportsDataSyncStatus,
  type SportsDataSyncType,
} from './sports-data.constants';
import type {
  SportsDataFinalResultDTO,
  SportsDataFixtureDTO,
  SportsDataProvider,
  SportsDataSyncSummary,
  SportsDataTeamDTO,
  SportsDataVenueDTO,
} from './sports-data.types';

export interface ConfirmExternalMatchResultInput {
  externalMatchResultId: string;
}

export interface ConfirmExternalMatchResultSummary {
  externalMatchResultId: string;
  externalMatchId: string;
  matchId: string;
  tournamentId: string;
  state: ExternalMatchResultState;
  confirmedAt: Date;
  finalizationSummary: FinalizeMatchSummary;
}

export interface DiscardExternalMatchResultInput {
  externalMatchResultId: string;
}

export interface DiscardExternalMatchResultSummary {
  externalMatchResultId: string;
  externalMatchId: string;
  matchId: string | null;
  tournamentId: string;
  state: ExternalMatchResultState;
  discardedAt: Date;
}

export interface ExternalMatchResultMatchSummary {
  matchId: string;
  status: MatchStatus;
  kickoffAt: Date;
  homeTeamName: string;
  awayTeamName: string;
  stage: string | null;
  groupName: string | null;
}

export interface ExternalMatchResultSummary {
  id: string;
  providerKey: string;
  externalMatchId: string;
  matchId: string | null;
  state: ExternalMatchResultState;
  homeScore: number;
  awayScore: number;
  playedAt: Date | null;
  stagedAt: Date;
  confirmedAt: Date | null;
  discardedAt: Date | null;
  match: ExternalMatchResultMatchSummary | null;
}

export interface ExternalMatchMappingDiagnosticResultSummary {
  externalMatchId: string;
  state: ExternalMatchResultState;
  homeScore: number;
  awayScore: number;
  stagedAt: Date;
  confirmedAt: Date | null;
  discardedAt: Date | null;
}

export interface ExternalMatchMappingDiagnosticSummary {
  matchId: string;
  status: MatchStatus;
  kickoffAt: Date;
  homeTeamName: string;
  awayTeamName: string;
  stage: string | null;
  groupName: string | null;
  externalMatchId: string | null;
  hasExternalReference: boolean;
  latestExternalResult: ExternalMatchMappingDiagnosticResultSummary | null;
}

export interface ExternalSyncRunSummary {
  syncRunId: string;
  providerKey: string;
  tournamentId: string;
  syncType: SportsDataSyncType;
  status: SportsDataSyncStatus;
  importedCount: number;
  updatedCount: number;
  stagedCount: number;
  skippedCount: number;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * Tournaments that are supported for provider sync operations.
 * Demo tournaments should not be synced with external providers.
 */
const SUPPORTED_PROVIDER_TOURNAMENT_SLUGS = ['world-cup-2026', 'liga-argentina-2026'] as const;

@Injectable()
export class SportsDataSyncService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SPORTS_DATA_PROVIDER) private readonly provider: SportsDataProvider,
    private readonly matchesService: MatchesService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  async confirmExternalMatchResult(
    input: ConfirmExternalMatchResultInput,
  ): Promise<ConfirmExternalMatchResultSummary> {
    const stagedResult = await this.prisma.externalMatchResult.findUnique({
      where: {
        id: input.externalMatchResultId,
      },
      select: {
        id: true,
        tournamentId: true,
        externalMatchId: true,
        matchId: true,
        homeScore: true,
        awayScore: true,
        state: true,
      },
    });

    if (stagedResult === null) {
      throw new NotFoundException(`External match result ${input.externalMatchResultId} was not found`);
    }

    if (stagedResult.state !== EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION) {
      throw new ConflictException(
        `External match result ${stagedResult.id} is already ${stagedResult.state.toLowerCase()}`,
      );
    }

    if (stagedResult.matchId === null) {
      throw new BadRequestException(
        `External match result ${stagedResult.id} is not linked to an internal match`,
      );
    }

    const finalizationSummary = await this.matchesService.finalizeMatch({
      matchId: stagedResult.matchId,
      homeScore: stagedResult.homeScore,
      awayScore: stagedResult.awayScore,
    });

    const confirmedAt = new Date();
    const confirmedResult = await this.prisma.externalMatchResult.update({
      where: {
        id: stagedResult.id,
      },
      data: {
        state: EXTERNAL_MATCH_RESULT_STATES.CONFIRMED,
        confirmedAt,
        discardedAt: null,
      },
      select: {
        id: true,
        tournamentId: true,
        externalMatchId: true,
        matchId: true,
        state: true,
        confirmedAt: true,
      },
    });

    if (confirmedResult.matchId === null || confirmedResult.confirmedAt === null) {
      throw new ConflictException(`External match result ${confirmedResult.id} could not be confirmed`);
    }

    return {
      externalMatchResultId: confirmedResult.id,
      externalMatchId: confirmedResult.externalMatchId,
      matchId: confirmedResult.matchId,
      tournamentId: confirmedResult.tournamentId,
      state: confirmedResult.state,
      confirmedAt: confirmedResult.confirmedAt,
      finalizationSummary,
    };
  }

  async discardExternalMatchResult(
    input: DiscardExternalMatchResultInput,
  ): Promise<DiscardExternalMatchResultSummary> {
    const stagedResult = await this.prisma.externalMatchResult.findUnique({
      where: {
        id: input.externalMatchResultId,
      },
      select: {
        id: true,
        tournamentId: true,
        externalMatchId: true,
        matchId: true,
        state: true,
      },
    });

    if (stagedResult === null) {
      throw new NotFoundException(`External match result ${input.externalMatchResultId} was not found`);
    }

    if (stagedResult.state !== EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION) {
      throw new ConflictException(
        `External match result ${stagedResult.id} is already ${stagedResult.state.toLowerCase()}`,
      );
    }

    const discardedAt = new Date();
    const discardedResult = await this.prisma.externalMatchResult.update({
      where: {
        id: stagedResult.id,
      },
      data: {
        state: EXTERNAL_MATCH_RESULT_STATES.DISCARDED,
        confirmedAt: null,
        discardedAt,
      },
      select: {
        id: true,
        tournamentId: true,
        externalMatchId: true,
        matchId: true,
        state: true,
        discardedAt: true,
      },
    });

    if (discardedResult.discardedAt === null) {
      throw new ConflictException(`External match result ${discardedResult.id} could not be discarded`);
    }

    return {
      externalMatchResultId: discardedResult.id,
      externalMatchId: discardedResult.externalMatchId,
      matchId: discardedResult.matchId,
      tournamentId: discardedResult.tournamentId,
      state: discardedResult.state,
      discardedAt: discardedResult.discardedAt,
    };
  }

  async listExternalMatchResults(input: {
    state?: ExternalMatchResultState;
    tournamentContext?: TournamentContextInput;
  } = {}): Promise<ExternalMatchResultSummary[]> {
    const state = input.state ?? EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION;

    const resolved = await this.tournamentsService.resolveTournamentContext(input.tournamentContext ?? {});
    const tournamentId = resolved.tournament.id;

    const externalMatchResults = await this.prisma.externalMatchResult.findMany({
      where: {
        state,
        tournamentId,
      },
      orderBy: {
        stagedAt: 'desc',
      },
      select: {
        id: true,
        providerKey: true,
        externalMatchId: true,
        matchId: true,
        state: true,
        homeScore: true,
        awayScore: true,
        playedAt: true,
        stagedAt: true,
        confirmedAt: true,
        discardedAt: true,
        match: {
          select: {
            id: true,
            status: true,
            kickoffAt: true,
            stage: true,
            groupName: true,
            homeTeam: {
              select: {
                name: true,
              },
            },
            awayTeam: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return externalMatchResults.map((result) => ({
      id: result.id,
      providerKey: result.providerKey,
      externalMatchId: result.externalMatchId,
      matchId: result.matchId,
      state: result.state,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      playedAt: result.playedAt,
      stagedAt: result.stagedAt,
      confirmedAt: result.confirmedAt,
      discardedAt: result.discardedAt,
      match: result.match
        ? {
            matchId: result.match.id,
            status: result.match.status,
            kickoffAt: result.match.kickoffAt,
            homeTeamName: result.match.homeTeam.name,
            awayTeamName: result.match.awayTeam.name,
            stage: result.match.stage,
            groupName: result.match.groupName,
          }
        : null,
    }));
  }

  async listExternalMatchMappingDiagnostics(input?: { tournamentContext?: TournamentContextInput }): Promise<ExternalMatchMappingDiagnosticSummary[]> {
    const resolved = await this.tournamentsService.resolveTournamentContext(input?.tournamentContext ?? {});
    const tournamentId = resolved.tournament.id;

    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
      },
      orderBy: {
        kickoffAt: 'asc',
      },
      select: {
        id: true,
        status: true,
        kickoffAt: true,
        stage: true,
        groupName: true,
        homeTeam: {
          select: {
            name: true,
          },
        },
        awayTeam: {
          select: {
            name: true,
          },
        },
        externalRefs: {
          where: {
            providerKey: this.provider.providerKey,
          },
          select: {
            externalId: true,
          },
          take: 1,
        },
        externalResults: {
          where: {
            providerKey: this.provider.providerKey,
          },
          orderBy: {
            stagedAt: 'desc',
          },
          select: {
            externalMatchId: true,
            state: true,
            homeScore: true,
            awayScore: true,
            stagedAt: true,
            confirmedAt: true,
            discardedAt: true,
          },
          take: 1,
        },
      },
    });

    return matches.map((match) => {
      const externalMatchId = match.externalRefs[0]?.externalId ?? null;
      const latestExternalResult = match.externalResults[0] ?? null;

      return {
        matchId: match.id,
        status: match.status,
        kickoffAt: match.kickoffAt,
        homeTeamName: match.homeTeam.name,
        awayTeamName: match.awayTeam.name,
        stage: match.stage,
        groupName: match.groupName,
        externalMatchId,
        hasExternalReference: externalMatchId !== null,
        latestExternalResult,
      };
    });
  }

  async listRecentSyncRuns(input?: { tournamentContext?: TournamentContextInput; limit?: number }): Promise<ExternalSyncRunSummary[]> {
    const resolved = await this.tournamentsService.resolveTournamentContext(input?.tournamentContext ?? {});
    const tournamentId = resolved.tournament.id;

    const syncRuns = await this.prisma.externalSyncRun.findMany({
      where: {
        tournamentId,
        providerKey: this.provider.providerKey,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: input?.limit ?? 6,
      select: {
        id: true,
        providerKey: true,
        tournamentId: true,
        syncType: true,
        status: true,
        importedCount: true,
        updatedCount: true,
        stagedCount: true,
        skippedCount: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
      },
    });

    return syncRuns.map((syncRun) => ({
      syncRunId: syncRun.id,
      providerKey: syncRun.providerKey,
      tournamentId: syncRun.tournamentId,
      syncType: syncRun.syncType,
      status: syncRun.status,
      importedCount: syncRun.importedCount,
      updatedCount: syncRun.updatedCount,
      stagedCount: syncRun.stagedCount,
      skippedCount: syncRun.skippedCount,
      errorMessage: syncRun.errorMessage,
      startedAt: syncRun.startedAt,
      completedAt: syncRun.completedAt,
    }));
  }

  async importTournament(tournamentId?: string): Promise<SportsDataSyncSummary> {
    // Use provided tournamentId or fall back to resolved context (for backward compatibility)
    const resolved = await this.tournamentsService.resolveTournamentContext({
      explicitTournamentId: tournamentId,
    });
    const resolvedTournament = resolved.tournament;

    // If explicitly provided, validate it's not a demo tournament
    if (tournamentId !== undefined && tournamentId !== null && tournamentId !== '') {
      this.assertTournamentSupportsProvider(resolved);
    }

    const providerTournamentKey = this.resolveProviderTournamentKey(resolvedTournament);
    const syncRun = await this.startSyncRun(resolvedTournament.id, SPORTS_DATA_SYNC_TYPES.IMPORT);

    let importedCount = 0;
    let updatedCount = 0;

    try {
      const teams = await this.provider.listTeams(providerTournamentKey);
      for (const team of teams) {
        const outcome = await this.syncTeam(resolvedTournament.id, team);
        importedCount += outcome.created ? 1 : 0;
        updatedCount += outcome.updated ? 1 : 0;
      }

      const venues = await this.provider.listVenues(providerTournamentKey);
      for (const venue of venues) {
        const outcome = await this.syncVenue(resolvedTournament.id, venue);
        importedCount += outcome.created ? 1 : 0;
        updatedCount += outcome.updated ? 1 : 0;
      }

      const fixtures = await this.provider.listFixtures(providerTournamentKey);
      for (const fixture of fixtures) {
        const outcome = await this.syncFixture(resolvedTournament.id, fixture);
        importedCount += outcome.created ? 1 : 0;
        updatedCount += outcome.updated ? 1 : 0;
      }

      return await this.finishSyncRun(syncRun.id, {
        status: SPORTS_DATA_SYNC_STATUSES.SUCCESS,
        importedCount,
        updatedCount,
        stagedCount: 0,
        skippedCount: 0,
      });
    } catch (error: unknown) {
      await this.finishSyncRun(syncRun.id, {
        status: SPORTS_DATA_SYNC_STATUSES.FAILED,
        importedCount,
        updatedCount,
        stagedCount: 0,
        skippedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown sports-data import error',
      });

      throw error;
    }
  }

  async syncResults(tournamentId?: string): Promise<SportsDataSyncSummary> {
    // Use provided tournamentId or fall back to resolved context (for backward compatibility)
    const resolved = await this.tournamentsService.resolveTournamentContext({
      explicitTournamentId: tournamentId,
    });
    const resolvedTournament = resolved.tournament;

    // If explicitly provided, validate it's not a demo tournament
    if (tournamentId !== undefined && tournamentId !== null && tournamentId !== '') {
      this.assertTournamentSupportsProvider(resolved);
    }

    const providerTournamentKey = this.resolveProviderTournamentKey(resolvedTournament);
    const syncRun = await this.startSyncRun(resolvedTournament.id, SPORTS_DATA_SYNC_TYPES.RESULTS);

    let stagedCount = 0;

    try {
      const results = await this.provider.listFinalResults(providerTournamentKey);

      for (const result of results) {
        const staged = await this.stageResult(resolvedTournament.id, syncRun.id, result);
        stagedCount += staged ? 1 : 0;
      }

      return await this.finishSyncRun(syncRun.id, {
        status: SPORTS_DATA_SYNC_STATUSES.SUCCESS,
        importedCount: 0,
        updatedCount: 0,
        stagedCount,
        skippedCount: 0,
      });
} catch (error: unknown) {
      await this.finishSyncRun(syncRun.id, {
        status: SPORTS_DATA_SYNC_STATUSES.FAILED,
        importedCount: 0,
        updatedCount: 0,
        stagedCount,
        skippedCount: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown sports-data result sync error',
      });

      throw error;
    }
  }

  /**
     * Asserts that a tournament supports provider sync operations.
   * Throws ForbiddenException for demo/manual tournaments when explicitly selected.
   */
  private assertTournamentSupportsProvider(tournament: ResolvedTournamentContext): void {
    // Only validate when explicitly selected (not fallback)
    if (tournament.source === 'active') {
      return; // Allow fallback to ACTIVE for backward compatibility
    }

    const isSupported = SUPPORTED_PROVIDER_TOURNAMENT_SLUGS.some(
      (supportedSlug) => tournament.tournament.slug === supportedSlug,
    );

    if (!isSupported) {
      throw new ForbiddenException(
        `Tournament "${tournament.tournament.name}" does not support provider sync operations. Only provider-backed tournaments can be synced.`,
      );
    }
  }

  private resolveProviderTournamentKey(tournament: { id: string; slug: string }): string {
    if (
      this.provider.providerKey === SPORTS_DATA_PROVIDER_KEYS.FOOTBALL_DATA ||
      this.provider.providerKey === SPORTS_DATA_PROVIDER_KEYS.API_SPORTS ||
      this.provider.providerKey === SPORTS_DATA_PROVIDER_KEYS.LPF_WEB
    ) {
      return tournament.slug;
    }
    return tournament.id;
  }

  private async startSyncRun(tournamentId: string, syncType: SportsDataSyncType) {
    return this.prisma.externalSyncRun.create({
      data: {
        providerKey: this.provider.providerKey,
        tournamentId,
        syncType,
        status: SPORTS_DATA_SYNC_STATUSES.RUNNING,
      },
      select: {
        id: true,
        providerKey: true,
        tournamentId: true,
        syncType: true,
      },
    });
  }

  private async finishSyncRun(
    syncRunId: string,
    input: {
      status: SportsDataSyncStatus;
      importedCount: number;
      updatedCount: number;
      stagedCount: number;
      skippedCount: number;
      errorMessage?: string;
    },
  ): Promise<SportsDataSyncSummary> {
    const syncRun = await this.prisma.externalSyncRun.update({
      where: { id: syncRunId },
      data: {
        status: input.status,
        importedCount: input.importedCount,
        updatedCount: input.updatedCount,
        stagedCount: input.stagedCount,
        skippedCount: input.skippedCount,
        errorMessage: input.errorMessage ?? null,
        completedAt: new Date(),
      },
      select: {
        id: true,
        providerKey: true,
        tournamentId: true,
        syncType: true,
        status: true,
        importedCount: true,
        updatedCount: true,
        stagedCount: true,
        skippedCount: true,
        errorMessage: true,
      },
    });

    return {
      syncRunId: syncRun.id,
      providerKey: syncRun.providerKey,
      tournamentId: syncRun.tournamentId,
      syncType: syncRun.syncType,
      status: syncRun.status,
      importedCount: syncRun.importedCount,
      updatedCount: syncRun.updatedCount,
      stagedCount: syncRun.stagedCount,
      skippedCount: syncRun.skippedCount,
      errorMessage: syncRun.errorMessage,
    };
  }

  private async syncTeam(
    tournamentId: string,
    team: SportsDataTeamDTO,
  ): Promise<{ created: boolean; updated: boolean }> {
    const existingReference = await this.prisma.externalTeamReference.findFirst({
      where: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalId: team.externalId,
      },
      select: {
        teamId: true,
      },
    });

    if (existingReference !== null) {
      await this.prisma.team.update({
        where: { id: existingReference.teamId },
        data: {
          name: team.name,
          shortName: team.shortName,
          countryCode: team.countryCode,
          flagCode: team.flagCode,
          primaryColor: team.primaryColor,
          secondaryColor: team.secondaryColor,
        },
      });

      return { created: false, updated: true };
    }

    const existingTeam = await this.prisma.team.findUnique({
      where: {
        tournamentId_name: {
          tournamentId,
          name: team.name,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingTeam !== null) {
      await this.prisma.team.update({
        where: { id: existingTeam.id },
        data: {
          shortName: team.shortName,
          countryCode: team.countryCode,
          flagCode: team.flagCode,
          primaryColor: team.primaryColor,
          secondaryColor: team.secondaryColor,
        },
      });

      await this.prisma.externalTeamReference.upsert({
        where: {
          providerKey_tournamentId_teamId: {
            providerKey: this.provider.providerKey,
            tournamentId,
            teamId: existingTeam.id,
          },
        },
        create: {
          providerKey: this.provider.providerKey,
          tournamentId,
          externalId: team.externalId,
          teamId: existingTeam.id,
        },
        update: {
          externalId: team.externalId,
        },
      });

      return { created: false, updated: true };
    }

    const createdTeam = await this.prisma.team.create({
      data: {
        tournamentId,
        name: team.name,
        shortName: team.shortName,
        countryCode: team.countryCode,
        flagCode: team.flagCode,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
      },
      select: { id: true },
    });

    await this.prisma.externalTeamReference.create({
      data: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalId: team.externalId,
        teamId: createdTeam.id,
      },
    });

    return { created: true, updated: false };
  }

  private async syncVenue(
    tournamentId: string,
    venue: SportsDataVenueDTO,
  ): Promise<{ created: boolean; updated: boolean }> {
    const existingReference = await this.prisma.externalVenueReference.findFirst({
      where: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalId: venue.externalId,
      },
      select: {
        venueId: true,
      },
    });

    if (existingReference !== null) {
      await this.prisma.venue.update({
        where: { id: existingReference.venueId },
        data: {
          name: venue.name,
          city: venue.city,
          countryCode: venue.countryCode,
          capacity: venue.capacity,
        },
      });

      await this.prisma.externalVenueReference.update({
        where: {
          providerKey_tournamentId_externalId: {
            providerKey: this.provider.providerKey,
            tournamentId,
            externalId: venue.externalId,
          },
        },
        data: {
          venueId: existingReference.venueId,
        },
      });

      return { created: false, updated: true };
    }

    const existingVenue = await this.prisma.venue.findUnique({
      where: {
        tournamentId_name: {
          tournamentId,
          name: venue.name,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingVenue !== null) {
      await this.prisma.venue.update({
        where: { id: existingVenue.id },
        data: {
          city: venue.city,
          countryCode: venue.countryCode,
          capacity: venue.capacity,
        },
      });

      await this.prisma.externalVenueReference.create({
        data: {
          providerKey: this.provider.providerKey,
          tournamentId,
          externalId: venue.externalId,
          venueId: existingVenue.id,
        },
      });

      return { created: false, updated: true };
    }

    const createdVenue = await this.prisma.venue.create({
      data: {
        tournamentId,
        name: venue.name,
        city: venue.city,
        countryCode: venue.countryCode,
        capacity: venue.capacity,
      },
      select: { id: true },
    });

    await this.prisma.externalVenueReference.create({
      data: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalId: venue.externalId,
        venueId: createdVenue.id,
      },
    });

    return { created: true, updated: false };
  }

  private async syncFixture(
    tournamentId: string,
    fixture: SportsDataFixtureDTO,
  ): Promise<{ created: boolean; updated: boolean }> {
    const homeTeam = await this.resolveTeamIdForTournament(tournamentId, fixture.homeTeamExternalId);
    const awayTeam = await this.resolveTeamIdForTournament(tournamentId, fixture.awayTeamExternalId);
    const venueId = await this.resolveVenueId(tournamentId, fixture.venueExternalId);

    const existingReference = await this.prisma.externalMatchReference.findFirst({
      where: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalId: fixture.externalId,
      },
      select: {
        matchId: true,
      },
    });

    if (existingReference !== null) {
      const currentMatch = await this.prisma.match.findUnique({
        where: { id: existingReference.matchId },
        select: {
          id: true,
          status: true,
        },
      });

      if (currentMatch === null) {
        throw new NotFoundException(`Match ${existingReference.matchId} was not found`);
      }

      await this.prisma.match.update({
        where: { id: currentMatch.id },
        data: {
          tournamentId,
          homeTeamId: homeTeam,
          awayTeamId: awayTeam,
          venueId,
          kickoffAt: fixture.kickoffAt,
          stage: fixture.stage,
          groupName: fixture.groupName,
          status: currentMatch.status === MatchStatus.FINISHED ? MatchStatus.FINISHED : MatchStatus.UPCOMING,
        },
      });

      await this.prisma.externalMatchReference.update({
        where: {
          providerKey_tournamentId_externalId: {
            providerKey: this.provider.providerKey,
            tournamentId,
            externalId: fixture.externalId,
          },
        },
        data: {
          matchId: currentMatch.id,
        },
      });

      return { created: false, updated: true };
    }

    const existingMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        homeTeamId: homeTeam,
        awayTeamId: awayTeam,
        kickoffAt: fixture.kickoffAt,
        stage: fixture.stage,
        groupName: fixture.groupName,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingMatch !== null) {
      await this.prisma.match.update({
        where: { id: existingMatch.id },
        data: {
          venueId,
          kickoffAt: fixture.kickoffAt,
          stage: fixture.stage,
          groupName: fixture.groupName,
          status: existingMatch.status === MatchStatus.FINISHED ? MatchStatus.FINISHED : MatchStatus.UPCOMING,
        },
      });

      await this.prisma.externalMatchReference.create({
        data: {
          providerKey: this.provider.providerKey,
          tournamentId,
          externalId: fixture.externalId,
          matchId: existingMatch.id,
        },
      });

      return { created: false, updated: true };
    }

    const createdMatch = await this.prisma.match.create({
      data: {
        tournamentId,
        homeTeamId: homeTeam,
        awayTeamId: awayTeam,
        venueId,
        kickoffAt: fixture.kickoffAt,
        stage: fixture.stage,
        groupName: fixture.groupName,
        status: MatchStatus.UPCOMING,
      },
      select: { id: true },
    });

    await this.prisma.externalMatchReference.create({
      data: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalId: fixture.externalId,
        matchId: createdMatch.id,
      },
    });

    return { created: true, updated: false };
  }

  private async resolveTeamId(externalTeamId: string): Promise<string> {
    throw new Error('resolveTeamId now requires tournamentId; use resolveTeamIdForTournament instead');
  }

  private async resolveTeamIdForTournament(tournamentId: string, externalTeamId: string): Promise<string> {
    const reference = await this.prisma.externalTeamReference.findFirst({
      where: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalId: externalTeamId,
      },
      select: {
        teamId: true,
      },
    });

    if (reference === null) {
      throw new NotFoundException(`External team ${externalTeamId} was not found for tournament ${tournamentId}`);
    }

    return reference.teamId;
  }

  private async resolveVenueId(tournamentId: string, externalVenueId: string | null): Promise<string | null> {
    if (externalVenueId === null) {
      return null;
    }

    const reference = await this.prisma.externalVenueReference.findFirst({
      where: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalId: externalVenueId,
      },
      select: {
        venueId: true,
      },
    });

    if (reference === null) {
      throw new NotFoundException(`External venue ${externalVenueId} was not found for tournament ${tournamentId}`);
    }

    return reference.venueId;
  }

  private async stageResult(
    tournamentId: string,
    syncRunId: string,
    result: SportsDataFinalResultDTO,
  ): Promise<boolean> {
    const existingReference = await this.prisma.externalMatchReference.findFirst({
      where: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalId: result.externalMatchId,
      },
      select: {
        matchId: true,
      },
    });

    await this.prisma.externalMatchResult.upsert({
      where: {
        providerKey_tournamentId_externalMatchId: {
          providerKey: this.provider.providerKey,
          tournamentId,
          externalMatchId: result.externalMatchId,
        },
      },
      create: {
        providerKey: this.provider.providerKey,
        tournamentId,
        externalMatchId: result.externalMatchId,
        matchId: existingReference?.matchId ?? null,
        externalSyncRunId: syncRunId,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        playedAt: result.playedAt,
      },
      update: {
        matchId: existingReference?.matchId ?? null,
        externalSyncRunId: syncRunId,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        playedAt: result.playedAt,
        state: 'PENDING_CONFIRMATION',
        confirmedAt: null,
        discardedAt: null,
      },
    });

    return true;
  }
}
