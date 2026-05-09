import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { MatchStatus, PredictionScoringStatus, ShareCardType, type Prediction } from '@prisma/client';

import { AppModule } from '../src/app.module';
import type { AuthenticatedIdentity } from '../src/auth/auth.types';
import type { FinalizeMatchInput } from '../src/matches/dto/finalize-match.dto';
import { MatchesService } from '../src/matches/matches.service';
import { PredictionsService } from '../src/predictions/predictions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RankingsService } from '../src/rankings/rankings.service';
import { ShareCardsService } from '../src/share-cards/share-cards.service';
import { TournamentsService } from '../src/tournaments/tournaments.service';
import {
  UsersService,
  type CurrentUserProfileView,
  type UpdateCurrentUserProfileInput,
} from '../src/users/users.service';
import { GroupsService } from '../src/groups/groups.service';

const SMOKE_MATCH = {
  stage: 'Smoke MVP Flow',
  groupName: 'Smoke MVP Flow',
  homeScore: 2,
  awayScore: 1,
  kickoffOffsetHours: 24,
} as const;

const SMOKE_GROUP_NAME = 'Smoke MVP Crew';

const SMOKE_USERS = [
  {
    label: 'user-a',
    identity: {
      authSubject: 'auth0|smoke-mvp-user-a',
      email: 'smoke-mvp-user-a@users.invalid',
      name: 'Smoke MVP User A',
      nickname: 'smoke-mvp-a',
      picture: null,
      permissions: [],
    } satisfies AuthenticatedIdentity,
    profile: {
      country: 'AR',
      favoriteTeamId: '',
      preferredLanguage: 'es',
    } satisfies UpdateCurrentUserProfileInput,
  },
  {
    label: 'user-b',
    identity: {
      authSubject: 'auth0|smoke-mvp-user-b',
      email: 'smoke-mvp-user-b@users.invalid',
      name: 'Smoke MVP User B',
      nickname: 'smoke-mvp-b',
      picture: null,
      permissions: [],
    } satisfies AuthenticatedIdentity,
    profile: {
      country: 'BR',
      favoriteTeamId: '',
      preferredLanguage: 'en',
    } satisfies UpdateCurrentUserProfileInput,
  },
] as const;

interface SmokeUserRecord {
  label: string;
  identity: AuthenticatedIdentity;
  profile: UpdateCurrentUserProfileInput;
}

interface SmokeUserState {
  label: string;
  id: string;
  username: string;
  identity: AuthenticatedIdentity;
  profile: CurrentUserProfileView;
}

interface SmokeTeamRecord {
  id: string;
  name: string;
  shortName: string;
}

interface SmokeMatchRecord {
  id: string;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  finalizedAt: Date | null;
}

interface SmokeGroupRecord {
  id: string;
  name: string;
  inviteCode: string;
  tournamentId: string;
  createdAt: Date;
}

interface SmokePredictionRecord extends Pick<Prediction, 'id' | 'userId' | 'matchId' | 'pointsAwarded' | 'scoringStatus'> {}

function asSmokeUserRecords(): SmokeUserRecord[] {
  return SMOKE_USERS.map((user) => ({
    label: user.label,
    identity: user.identity,
    profile: user.profile,
  }));
}

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureSmokeMatch(input: {
  prisma: PrismaService;
  tournamentId: string;
  homeTeamId: string;
  awayTeamId: string;
}): Promise<SmokeMatchRecord> {
  const kickoffAt = new Date(Date.now() + SMOKE_MATCH.kickoffOffsetHours * 60 * 60 * 1000);

  const existingMatch = await input.prisma.match.findFirst({
    where: {
      tournamentId: input.tournamentId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      stage: SMOKE_MATCH.stage,
      groupName: SMOKE_MATCH.groupName,
    },
    select: {
      id: true,
      tournamentId: true,
      homeTeamId: true,
      awayTeamId: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      finalizedAt: true,
    },
  });

  if (existingMatch === null) {
    return input.prisma.match.create({
      data: {
        tournamentId: input.tournamentId,
        homeTeamId: input.homeTeamId,
        awayTeamId: input.awayTeamId,
        stage: SMOKE_MATCH.stage,
        groupName: SMOKE_MATCH.groupName,
        kickoffAt,
        status: MatchStatus.UPCOMING,
      },
      select: {
        id: true,
        tournamentId: true,
        homeTeamId: true,
        awayTeamId: true,
        kickoffAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        finalizedAt: true,
      },
    });
  }

  return input.prisma.match.update({
    where: { id: existingMatch.id },
    data: {
      kickoffAt,
      status: MatchStatus.UPCOMING,
      homeScore: null,
      awayScore: null,
      finalizedAt: null,
    },
    select: {
      id: true,
      tournamentId: true,
      homeTeamId: true,
      awayTeamId: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      finalizedAt: true,
    },
  });
}

async function ensureSmokeGroup(input: {
  prisma: PrismaService;
  groupsService: GroupsService;
  tournamentId: string;
  ownerId: string;
  identity: AuthenticatedIdentity;
}): Promise<SmokeGroupRecord> {
  const existingGroup = await input.prisma.group.findFirst({
    where: {
      tournamentId: input.tournamentId,
      ownerId: input.ownerId,
      name: SMOKE_GROUP_NAME,
    },
    select: {
      id: true,
      name: true,
      inviteCode: true,
      tournamentId: true,
      createdAt: true,
    },
  });

  if (existingGroup !== null) {
    return existingGroup;
  }

  return input.groupsService.createGroup({
    identity: input.identity,
    name: SMOKE_GROUP_NAME,
  }) as Promise<SmokeGroupRecord>;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });

  try {
    const prisma = app.get(PrismaService);
    const tournamentsService = app.get(TournamentsService);
    const usersService = app.get(UsersService);
    const groupsService = app.get(GroupsService);
    const predictionsService = app.get(PredictionsService);
    const matchesService = app.get(MatchesService);
    const rankingsService = app.get(RankingsService);
    const shareCardsService = app.get(ShareCardsService);

    const activeTournament = await tournamentsService.getActiveTournament();
    const activeTournamentMatches = await tournamentsService.getActiveTournamentMatches();

    assertCondition(activeTournamentMatches.length > 0, `Active tournament ${activeTournament.id} has no seeded matches`);

    const teams = await prisma.team.findMany({
      where: {
        tournamentId: activeTournament.id,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        shortName: true,
      },
    });

    assertCondition(teams.length >= 2, `Active tournament ${activeTournament.id} needs at least two teams for smoke testing`);

    const smokeTeams: [SmokeTeamRecord, SmokeTeamRecord] = [
      {
        id: teams[0]?.id ?? '',
        name: teams[0]?.name ?? '',
        shortName: teams[0]?.shortName ?? '',
      },
      {
        id: teams[1]?.id ?? '',
        name: teams[1]?.name ?? '',
        shortName: teams[1]?.shortName ?? '',
      },
    ];

    assertCondition(smokeTeams[0].id.length > 0 && smokeTeams[1].id.length > 0, 'Could not resolve smoke teams');

    const smokeMatch = await ensureSmokeMatch({
      prisma,
      tournamentId: activeTournament.id,
      homeTeamId: smokeTeams[0].id,
      awayTeamId: smokeTeams[1].id,
    });

    const smokeUsers = asSmokeUserRecords();
    const syncedUsers = await Promise.all(
      smokeUsers.map(async (user) => {
        const syncedUser = await usersService.syncAuthenticatedUser(user.identity);
        const profile: UpdateCurrentUserProfileInput = {
          country: user.profile.country,
          favoriteTeamId: user.label === 'user-a' ? smokeTeams[0].id : smokeTeams[1].id,
          preferredLanguage: user.profile.preferredLanguage,
        };

        const updatedProfile = await usersService.updateCurrentUserProfile(user.identity, profile);

        return {
          label: user.label,
          id: syncedUser.id,
          username: syncedUser.username,
          identity: user.identity,
          profile: updatedProfile,
        } satisfies SmokeUserState;
      }),
    );

    const smokeUserA = syncedUsers[0];
    const smokeUserB = syncedUsers[1];

    assertCondition(smokeUserA !== undefined && smokeUserB !== undefined, 'Smoke users were not prepared');

    const smokeGroup = await ensureSmokeGroup({
      prisma,
      groupsService,
      tournamentId: activeTournament.id,
      ownerId: smokeUserA.id,
      identity: smokeUserA.identity,
    });

    await groupsService.joinGroup({
      identity: smokeUserB.identity,
      inviteCode: smokeGroup.inviteCode,
    });

    await prisma.prediction.deleteMany({
      where: {
        matchId: smokeMatch.id,
        userId: {
          in: [smokeUserA.id, smokeUserB.id],
        },
      },
    });

    const submittedPredictions = await Promise.all(
      syncedUsers.map((user) =>
        predictionsService.submitPrediction({
          identity: user.identity,
          matchId: smokeMatch.id,
          homeScore: SMOKE_MATCH.homeScore,
          awayScore: SMOKE_MATCH.awayScore,
        }),
      ),
    );

    const finalizationSummary = await matchesService.finalizeMatch({
      matchId: smokeMatch.id,
      homeScore: SMOKE_MATCH.homeScore,
      awayScore: SMOKE_MATCH.awayScore,
    } satisfies FinalizeMatchInput);

    const scoringRule = await prisma.scoringRule.findFirst({
      where: {
        tournamentId: activeTournament.id,
        isActive: true,
      },
      select: {
        exactScore: true,
      },
    });

    assertCondition(scoringRule !== null, `Active scoring rule not found for tournament ${activeTournament.id}`);

    const expectedPoints = scoringRule.exactScore;

    const smokePredictions = await prisma.prediction.findMany({
      where: {
        matchId: smokeMatch.id,
        userId: {
          in: [smokeUserA.id, smokeUserB.id],
        },
      },
      select: {
        id: true,
        userId: true,
        matchId: true,
        pointsAwarded: true,
        scoringStatus: true,
      },
    });

    assertCondition(smokePredictions.length === 2, 'Smoke predictions were not found for both users');

    for (const prediction of smokePredictions) {
      assertCondition(prediction.scoringStatus === PredictionScoringStatus.SCORED, `Prediction ${prediction.id} was not scored`);
      assertCondition(prediction.pointsAwarded === expectedPoints, `Prediction ${prediction.id} scored ${prediction.pointsAwarded}, expected ${expectedPoints}`);
    }

    const globalRanking = await rankingsService.getActiveGlobalRanking();
    const globalRankingByUserId = new Map(globalRanking.map((entry) => [entry.userId, entry] as const));

    assertCondition(globalRankingByUserId.has(smokeUserA.id), 'Global ranking is missing smoke user A');
    assertCondition(globalRankingByUserId.has(smokeUserB.id), 'Global ranking is missing smoke user B');

    const userARanking = globalRankingByUserId.get(smokeUserA.id);
    const userBRanking = globalRankingByUserId.get(smokeUserB.id);

    assertCondition(userARanking !== undefined && userBRanking !== undefined, 'Global ranking entries could not be resolved');
    assertCondition(userARanking.totalPoints === expectedPoints, `Global ranking for user A has ${userARanking.totalPoints} points, expected ${expectedPoints}`);
    assertCondition(userBRanking.totalPoints === expectedPoints, `Global ranking for user B has ${userBRanking.totalPoints} points, expected ${expectedPoints}`);

    const groupRanking = await rankingsService.getGroupRanking({
      identity: smokeUserA.identity,
      groupId: smokeGroup.id,
    });

    const groupRankingByUserId = new Map(groupRanking.map((entry) => [entry.userId, entry] as const));

    assertCondition(groupRankingByUserId.has(smokeUserA.id), 'Group ranking is missing smoke user A');
    assertCondition(groupRankingByUserId.has(smokeUserB.id), 'Group ranking is missing smoke user B');

    const userAGroupRanking = groupRankingByUserId.get(smokeUserA.id);
    const userBGroupRanking = groupRankingByUserId.get(smokeUserB.id);

    assertCondition(userAGroupRanking !== undefined && userBGroupRanking !== undefined, 'Group ranking entries could not be resolved');
    assertCondition(userAGroupRanking.totalPoints === expectedPoints, `Group ranking for user A has ${userAGroupRanking.totalPoints} points, expected ${expectedPoints}`);
    assertCondition(userBGroupRanking.totalPoints === expectedPoints, `Group ranking for user B has ${userBGroupRanking.totalPoints} points, expected ${expectedPoints}`);

    await prisma.shareCard.deleteMany({
      where: {
        tournamentId: activeTournament.id,
        userId: smokeUserA.id,
        type: ShareCardType.PERFORMANCE_SUMMARY,
      },
    });

    await prisma.shareCard.deleteMany({
      where: {
        tournamentId: activeTournament.id,
        userId: smokeUserA.id,
        groupId: smokeGroup.id,
        type: ShareCardType.GROUP_RANKING,
      },
    });

    const globalShareCard = await shareCardsService.createMyGlobalRankingShareCard(smokeUserA.identity);
    const groupShareCard = await shareCardsService.createGroupRankingShareCard(smokeUserA.identity, smokeGroup.id);

    assertCondition(globalShareCard.type === ShareCardType.PERFORMANCE_SUMMARY, 'Unexpected global share card type');
    assertCondition(groupShareCard.type === ShareCardType.GROUP_RANKING, 'Unexpected group share card type');

    console.log('Smoke MVP flow succeeded');
    console.log(JSON.stringify({
      tournamentId: activeTournament.id,
      matchId: smokeMatch.id,
      groupId: smokeGroup.id,
      userA: smokeUserA.id,
      userB: smokeUserB.id,
      expectedPoints,
      finalizationSummary,
      submittedPredictions: submittedPredictions.map((prediction) => ({
        id: prediction.id,
        scoringStatus: prediction.scoringStatus,
        pointsAwarded: prediction.pointsAwarded,
      })),
      globalRanking: globalRanking.map((entry) => ({
        userId: entry.userId,
        position: entry.position,
        totalPoints: entry.totalPoints,
      })),
      groupRanking: groupRanking.map((entry) => ({
        userId: entry.userId,
        position: entry.position,
        totalPoints: entry.totalPoints,
      })),
      shareCards: {
        global: { id: globalShareCard.id, type: globalShareCard.type },
        group: { id: groupShareCard.id, type: groupShareCard.type },
      },
    }, null, 2));
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error('Smoke MVP flow failed');
  console.error(error);
  process.exitCode = 1;
});
