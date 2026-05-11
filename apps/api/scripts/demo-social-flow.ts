import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { MatchStatus, ShareCardType } from '@prisma/client';

import { AppModule } from '../src/app.module';
import type { AuthenticatedIdentity } from '../src/auth/auth.types';
import type { CurrentUserProfileView, UpdateCurrentUserProfileInput } from '../src/users/users.service';
import { GroupsService } from '../src/groups/groups.service';
import { MatchesService } from '../src/matches/matches.service';
import { PredictionsService } from '../src/predictions/predictions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RankingsService } from '../src/rankings/rankings.service';
import { ShareCardsService } from '../src/share-cards/share-cards.service';
import { TournamentsService } from '../src/tournaments/tournaments.service';
import { UsersService } from '../src/users/users.service';

const DEMO_MATCH_STAGE = 'DEV Demo Social';
const DEMO_MATCH_GROUP = 'DEV Demo Social';
const DEMO_GROUP_NAME = 'DEV Demo Social Crew';

const DEMO_USERS = {
  owner: {
    identity: {
      authSubject: 'auth0|dev-demo-social-owner',
      email: 'dev-demo-social-owner@users.invalid',
      name: 'DEV Demo Owner',
      nickname: 'dev-demo-owner',
      picture: null,
      permissions: [],
    } satisfies AuthenticatedIdentity,
    profile: {
      country: 'AR',
      preferredLanguage: 'es',
      favoriteTeamName: 'Argentina',
    },
  },
  memberOne: {
    identity: {
      authSubject: 'auth0|dev-demo-social-member-one',
      email: 'dev-demo-social-member-one@users.invalid',
      name: 'DEV Demo Member One',
      nickname: 'dev-demo-member-one',
      picture: null,
      permissions: [],
    } satisfies AuthenticatedIdentity,
    profile: {
      country: 'BR',
      preferredLanguage: 'en',
      favoriteTeamName: 'Brazil',
    },
  },
  memberTwo: {
    identity: {
      authSubject: 'auth0|dev-demo-social-member-two',
      email: 'dev-demo-social-member-two@users.invalid',
      name: 'DEV Demo Member Two',
      nickname: 'dev-demo-member-two',
      picture: null,
      permissions: [],
    } satisfies AuthenticatedIdentity,
    profile: {
      country: 'FR',
      preferredLanguage: 'en',
      favoriteTeamName: 'France',
    },
  },
  observer: {
    identity: {
      authSubject: 'auth0|dev-demo-social-observer',
      email: 'dev-demo-social-observer@users.invalid',
      name: 'DEV Demo Observer',
      nickname: 'dev-demo-observer',
      picture: null,
      permissions: [],
    } satisfies AuthenticatedIdentity,
    profile: {
      country: 'ES',
      preferredLanguage: 'es',
      favoriteTeamName: 'Spain',
    },
  },
} as const;

type DemoUserKey = keyof typeof DEMO_USERS;

interface ScorePair {
  homeScore: number;
  awayScore: number;
}

interface DemoMatchPlan {
  key: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: Date;
  shouldFinalize: boolean;
  actualScore: ScorePair | null;
  predictions: Record<DemoUserKey, ScorePair>;
}

interface DemoUserState {
  id: string;
  username: string;
  identity: AuthenticatedIdentity;
  profile: CurrentUserProfileView;
}

interface DemoMatchRecord {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  finalizedAt: Date | null;
  stage: string | null;
  groupName: string | null;
}

interface DemoGroupRecord {
  id: string;
  name: string;
  inviteCode: string;
  tournamentId: string;
  createdAt: Date;
}

const DEMO_MATCH_PLANS = [
  {
    key: 'argentina-england-demo',
    homeTeamName: 'Argentina',
    awayTeamName: 'England',
    kickoffAt: new Date(Date.UTC(2099, 0, 1, 18, 0, 0)),
    shouldFinalize: true,
    actualScore: {
      homeScore: 2,
      awayScore: 1,
    },
    predictions: {
      owner: { homeScore: 2, awayScore: 1 },
      memberOne: { homeScore: 2, awayScore: 0 },
      memberTwo: { homeScore: 0, awayScore: 1 },
      observer: { homeScore: 1, awayScore: 1 },
    },
  },
  {
    key: 'brazil-germany-demo',
    homeTeamName: 'Brazil',
    awayTeamName: 'Germany',
    kickoffAt: new Date(Date.UTC(2099, 0, 2, 18, 0, 0)),
    shouldFinalize: true,
    actualScore: {
      homeScore: 1,
      awayScore: 1,
    },
    predictions: {
      owner: { homeScore: 1, awayScore: 1 },
      memberOne: { homeScore: 1, awayScore: 0 },
      memberTwo: { homeScore: 0, awayScore: 2 },
      observer: { homeScore: 2, awayScore: 2 },
    },
  },
  {
    key: 'france-portugal-demo',
    homeTeamName: 'France',
    awayTeamName: 'Portugal',
    kickoffAt: new Date(Date.UTC(2099, 0, 3, 18, 0, 0)),
    shouldFinalize: true,
    actualScore: {
      homeScore: 3,
      awayScore: 2,
    },
    predictions: {
      owner: { homeScore: 3, awayScore: 2 },
      memberOne: { homeScore: 2, awayScore: 2 },
      memberTwo: { homeScore: 1, awayScore: 0 },
      observer: { homeScore: 3, awayScore: 1 },
    },
  },
  {
    key: 'spain-uruguay-open-demo',
    homeTeamName: 'Spain',
    awayTeamName: 'Uruguay',
    kickoffAt: new Date(Date.UTC(2099, 0, 4, 18, 0, 0)),
    shouldFinalize: false,
    actualScore: null,
    predictions: {
      owner: { homeScore: 2, awayScore: 1 },
      memberOne: { homeScore: 1, awayScore: 0 },
      memberTwo: { homeScore: 0, awayScore: 0 },
      observer: { homeScore: 1, awayScore: 2 },
    },
  },
] as const satisfies readonly DemoMatchPlan[];

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function makeDemoMatchKey(plan: Pick<DemoMatchPlan, 'key'>): string {
  return plan.key;
}

async function ensureDemoMatch(
  prisma: PrismaService,
  tournamentId: string,
  teamIdByName: Map<string, string>,
  plan: DemoMatchPlan,
): Promise<DemoMatchRecord> {
  const homeTeamId = teamIdByName.get(plan.homeTeamName);
  const awayTeamId = teamIdByName.get(plan.awayTeamName);

  assertCondition(homeTeamId !== undefined, `Could not resolve team ${plan.homeTeamName}`);
  assertCondition(awayTeamId !== undefined, `Could not resolve team ${plan.awayTeamName}`);

  const existingMatch = await prisma.match.findFirst({
    where: {
      tournamentId,
      homeTeamId,
      awayTeamId,
      stage: DEMO_MATCH_STAGE,
      groupName: DEMO_MATCH_GROUP,
    },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      finalizedAt: true,
      stage: true,
      groupName: true,
    },
  });

  if (existingMatch !== null) {
    return prisma.match.update({
      where: { id: existingMatch.id },
      data: {
        kickoffAt: plan.kickoffAt,
        stage: DEMO_MATCH_STAGE,
        groupName: DEMO_MATCH_GROUP,
      },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        kickoffAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        finalizedAt: true,
        stage: true,
        groupName: true,
      },
    });
  }

  return prisma.match.create({
    data: {
      tournamentId,
      homeTeamId,
      awayTeamId,
      kickoffAt: plan.kickoffAt,
      stage: DEMO_MATCH_STAGE,
      groupName: DEMO_MATCH_GROUP,
      status: MatchStatus.UPCOMING,
    },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      finalizedAt: true,
      stage: true,
      groupName: true,
    },
  });
}

async function ensureDemoMatches(
  prisma: PrismaService,
  tournamentId: string,
  teamIdByName: Map<string, string>,
): Promise<Record<string, DemoMatchRecord>> {
  const entries = await Promise.all(
    DEMO_MATCH_PLANS.map(async (plan) => [makeDemoMatchKey(plan), await ensureDemoMatch(prisma, tournamentId, teamIdByName, plan)] as const),
  );

  return Object.fromEntries(entries) as Record<string, DemoMatchRecord>;
}

async function ensureDemoUsers(
  usersService: UsersService,
  teamIdByName: Map<string, string>,
): Promise<Record<DemoUserKey, DemoUserState>> {
  const demoUsers = {} as Record<DemoUserKey, DemoUserState>;

  for (const key of Object.keys(DEMO_USERS) as DemoUserKey[]) {
    const user = DEMO_USERS[key];
    const favoriteTeamId = teamIdByName.get(user.profile.favoriteTeamName);
    assertCondition(favoriteTeamId !== undefined, `Could not resolve favorite team ${user.profile.favoriteTeamName}`);

    const syncedUser = await usersService.syncAuthenticatedUser(user.identity);
    const profile = await usersService.updateCurrentUserProfile(user.identity, {
      country: user.profile.country,
      favoriteTeamId,
      preferredLanguage: user.profile.preferredLanguage,
    } satisfies UpdateCurrentUserProfileInput);

    demoUsers[key] = {
      id: syncedUser.id,
      username: syncedUser.username,
      identity: user.identity,
      profile,
    };
  }

  return demoUsers;
}

async function ensureDemoGroup(input: {
  prisma: PrismaService;
  groupsService: GroupsService;
  tournamentId: string;
  owner: DemoUserState;
}): Promise<DemoGroupRecord> {
  const existingGroup = await input.prisma.group.findFirst({
    where: {
      tournamentId: input.tournamentId,
      ownerId: input.owner.id,
      name: DEMO_GROUP_NAME,
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
    identity: input.owner.identity,
    name: DEMO_GROUP_NAME,
  });
}

async function resetDemoMatches(prisma: PrismaService, matches: DemoMatchRecord[]): Promise<void> {
  await Promise.all(
    matches.map((match) => prisma.match.update({
      where: { id: match.id },
      data: {
        status: MatchStatus.UPCOMING,
        homeScore: null,
        awayScore: null,
        finalizedAt: null,
      },
    })),
  );
}

async function reloadDemoMatches(
  prisma: PrismaService,
  demoMatches: Record<string, DemoMatchRecord>,
): Promise<Record<string, DemoMatchRecord>> {
  const refreshedMatches = {} as Record<string, DemoMatchRecord>;

  for (const plan of DEMO_MATCH_PLANS) {
    const match = demoMatches[plan.key];
    assertCondition(match !== undefined, `Could not resolve demo match ${plan.key}`);

    const refreshedMatch = await prisma.match.findUnique({
      where: { id: match.id },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        kickoffAt: true,
        status: true,
        homeScore: true,
        awayScore: true,
        finalizedAt: true,
        stage: true,
        groupName: true,
      },
    });

    assertCondition(refreshedMatch !== null, `Could not reload demo match ${plan.key}`);
    refreshedMatches[plan.key] = refreshedMatch;
  }

  return refreshedMatches;
}

async function clearDemoPredictions(prisma: PrismaService, matchIds: string[], userIds: string[]): Promise<void> {
  await prisma.prediction.deleteMany({
    where: {
      matchId: { in: matchIds },
      userId: { in: userIds },
    },
  });
}

async function submitDemoPredictions(input: {
  predictionsService: PredictionsService;
  matchByKey: Record<string, DemoMatchRecord>;
  demoUsers: Record<DemoUserKey, DemoUserState>;
}): Promise<void> {
  for (const plan of DEMO_MATCH_PLANS) {
    const match = input.matchByKey[makeDemoMatchKey(plan)];
    assertCondition(match !== undefined, `Could not resolve demo match ${plan.homeTeamName} vs ${plan.awayTeamName}`);

    for (const [key, user] of Object.entries(input.demoUsers) as Array<[DemoUserKey, DemoUserState]>) {
      const prediction = plan.predictions[key];

      await input.predictionsService.submitPrediction({
        identity: user.identity,
        matchId: match.id,
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
      });
    }
  }
}

async function finalizeDemoMatches(input: {
  matchesService: MatchesService;
  matchByKey: Record<string, DemoMatchRecord>;
}): Promise<Array<{ matchId: string; scoringSummary: unknown; globalRankingSummary: unknown }>> {
  const summaries: Array<{ matchId: string; scoringSummary: unknown; globalRankingSummary: unknown }> = [];

  for (const plan of DEMO_MATCH_PLANS) {
    if (!plan.shouldFinalize || plan.actualScore === null) {
      continue;
    }

    const match = input.matchByKey[makeDemoMatchKey(plan)];
    assertCondition(match !== undefined, `Could not resolve demo match ${plan.homeTeamName} vs ${plan.awayTeamName}`);

    const summary = await input.matchesService.finalizeMatch({
      matchId: match.id,
      homeScore: plan.actualScore.homeScore,
      awayScore: plan.actualScore.awayScore,
    });

    summaries.push({
      matchId: match.id,
      scoringSummary: summary.scoringSummary,
      globalRankingSummary: summary.globalRankingSummary,
    });
  }

  return summaries;
}

async function refreshShareCards(input: {
  prisma: PrismaService;
  shareCardsService: ShareCardsService;
  owner: DemoUserState;
  groupId: string;
  predictionMatchId: string;
  tournamentId: string;
}): Promise<{ globalShareCardId: string; groupShareCardId: string; predictionShareCardId: string }> {
  await input.prisma.shareCard.deleteMany({
    where: {
      tournamentId: input.tournamentId,
      userId: input.owner.id,
      type: ShareCardType.PERFORMANCE_SUMMARY,
    },
  });

  await input.prisma.shareCard.deleteMany({
    where: {
      tournamentId: input.tournamentId,
      userId: input.owner.id,
      groupId: input.groupId,
      type: ShareCardType.GROUP_RANKING,
    },
  });

  await input.prisma.shareCard.deleteMany({
    where: {
      tournamentId: input.tournamentId,
      userId: input.owner.id,
      matchId: input.predictionMatchId,
      type: ShareCardType.PREDICTION,
    },
  });

  const globalShareCard = await input.shareCardsService.createMyGlobalRankingShareCard(input.owner.identity);
  const groupShareCard = await input.shareCardsService.createGroupRankingShareCard(input.owner.identity, input.groupId);
  const predictionShareCard = await input.shareCardsService.createPredictionShareCard(input.owner.identity, input.predictionMatchId);

  return {
    globalShareCardId: globalShareCard.id,
    groupShareCardId: groupShareCard.id,
    predictionShareCardId: predictionShareCard.id,
  };
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
    const tournamentTeams = await prisma.team.findMany({
      where: {
        tournamentId: activeTournament.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    assertCondition(tournamentTeams.length > 0, `Active tournament ${activeTournament.id} has no teams`);

    const teamIdByName = new Map(tournamentTeams.map((team) => [team.name, team.id] as const));
    const demoMatches = await ensureDemoMatches(prisma, activeTournament.id, teamIdByName);
    const demoUsers = await ensureDemoUsers(usersService, teamIdByName);
    const demoGroup = await ensureDemoGroup({
      prisma,
      groupsService,
      tournamentId: activeTournament.id,
      owner: demoUsers.owner,
    });

    await Promise.all([
      groupsService.joinGroup({ identity: demoUsers.owner.identity, inviteCode: demoGroup.inviteCode }),
      groupsService.joinGroup({ identity: demoUsers.memberOne.identity, inviteCode: demoGroup.inviteCode }),
      groupsService.joinGroup({ identity: demoUsers.memberTwo.identity, inviteCode: demoGroup.inviteCode }),
      groupsService.joinGroup({ identity: demoUsers.observer.identity, inviteCode: demoGroup.inviteCode }),
    ]);

    const demoMatchList = Object.values(demoMatches);
    const demoMatchIds = demoMatchList.map((match) => match.id);

    await clearDemoPredictions(prisma, demoMatchIds, Object.values(demoUsers).map((user) => user.id));
    await resetDemoMatches(prisma, demoMatchList);
    await submitDemoPredictions({
      predictionsService,
      matchByKey: demoMatches,
      demoUsers,
    });

    const finalizationSummaries = await finalizeDemoMatches({
      matchesService,
      matchByKey: demoMatches,
    });
    const refreshedDemoMatches = await reloadDemoMatches(prisma, demoMatches);

    const openDemoMatch = DEMO_MATCH_PLANS.find((plan) => plan.shouldFinalize === false);
    assertCondition(openDemoMatch !== undefined, 'Open demo match plan was not found');
    const predictionShareCardMatch = demoMatches[openDemoMatch.key];
    assertCondition(predictionShareCardMatch !== undefined, `Could not resolve open demo match ${openDemoMatch.key}`);

    const shareCards = await refreshShareCards({
      prisma,
      shareCardsService,
      owner: demoUsers.owner,
      groupId: demoGroup.id,
      predictionMatchId: predictionShareCardMatch.id,
      tournamentId: activeTournament.id,
    });

    const globalRanking = await rankingsService.getActiveGlobalRanking();
    const groupRanking = await rankingsService.getGroupRanking({
      identity: demoUsers.owner.identity,
      groupId: demoGroup.id,
    });

    console.log('DEV demo social flow refreshed');
    console.log(JSON.stringify({
      tournamentId: activeTournament.id,
      group: demoGroup,
      users: Object.fromEntries(
        Object.entries(demoUsers).map(([key, user]) => [key, {
          id: user.id,
          username: user.username,
          country: user.profile.country,
          favoriteTeamId: user.profile.favoriteTeamId,
        }]),
      ),
      demoMatches: Object.fromEntries(
        Object.entries(refreshedDemoMatches).map(([key, match]) => [key, {
          id: match.id,
          status: match.status,
          kickoffAt: match.kickoffAt,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          finalizedAt: match.finalizedAt,
          stage: match.stage,
          groupName: match.groupName,
        }]),
      ),
      finalizationSummaries,
      globalRanking: globalRanking.slice(0, 10).map((entry) => ({
        userId: entry.userId,
        username: entry.username,
        position: entry.position,
        totalPoints: entry.totalPoints,
        exactPredictions: entry.exactPredictions,
      })),
      groupRanking: groupRanking.map((entry) => ({
        userId: entry.userId,
        username: entry.username,
        position: entry.position,
        totalPoints: entry.totalPoints,
        exactPredictions: entry.exactPredictions,
      })),
      shareCards,
    }, null, 2));
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error('DEV demo social flow failed');
  console.error(error);
  process.exitCode = 1;
});
