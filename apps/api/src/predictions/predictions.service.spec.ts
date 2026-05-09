import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatchStatus, PredictionScoringStatus, type Match, type Prediction } from '@prisma/client';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { UsersService } from '../users/users.service';
import { PredictionsService } from './predictions.service';

interface MatchFindUniqueArgs {
  where: { id: string };
  select: {
    id: boolean;
    tournamentId: boolean;
    kickoffAt: boolean;
    status: boolean;
  };
}

interface PredictionUpsertArgs {
  where: {
    userId_matchId: {
      userId: string;
      matchId: string;
    };
  };
  create: {
    tournamentId: string;
    matchId: string;
    userId: string;
    homeScore: number;
    awayScore: number;
    pointsAwarded: number;
    scoringStatus: PredictionScoringStatus;
  };
  update: {
    tournamentId: string;
    homeScore: number;
    awayScore: number;
    pointsAwarded: number;
    scoringStatus: PredictionScoringStatus;
  };
  select: Record<string, boolean>;
}

interface PredictionFindManyArgs {
  where: {
    userId: string;
  };
  orderBy: Array<Record<string, 'asc' | 'desc'>>;
  select: Record<string, boolean>;
}

interface SyncAuthenticatedUserInput {
  authSubject: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  picture: string | null;
  permissions: string[];
}

interface UserRecord {
  id: string;
}

interface MatchRecord extends Pick<Match, 'id' | 'tournamentId' | 'kickoffAt' | 'status'> {}

interface PredictionRecord extends Pick<Prediction, 'id' | 'matchId' | 'tournamentId' | 'homeScore' | 'awayScore' | 'pointsAwarded' | 'scoringStatus' | 'submittedAt' | 'updatedAt' | 'scoredAt'> {}

interface PrismaMock {
  match: {
    findUnique: jest.Mock<Promise<MatchRecord | null>, [MatchFindUniqueArgs]>;
  };
  prediction: {
    upsert: jest.Mock<Promise<PredictionRecord>, [PredictionUpsertArgs]>;
    findMany: jest.Mock<Promise<PredictionRecord[]>, [PredictionFindManyArgs]>;
  };
}

function createIdentity(overrides: Partial<AuthenticatedIdentity> = {}): AuthenticatedIdentity {
  return {
    authSubject: 'auth0|123456789',
    email: 'messi@example.com',
    name: 'Lionel Messi',
    nickname: 'messi',
    picture: null,
    permissions: [],
    ...overrides,
  };
}

function createMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: 'match-1',
    tournamentId: 'tournament-1',
    kickoffAt: new Date('2026-05-08T18:00:00.000Z'),
    status: MatchStatus.UPCOMING,
    ...overrides,
  };
}

function createPrediction(overrides: Partial<PredictionRecord> = {}): PredictionRecord {
  return {
    id: 'prediction-1',
    matchId: 'match-1',
    tournamentId: 'tournament-1',
    homeScore: 1,
    awayScore: 0,
    pointsAwarded: 0,
    scoringStatus: PredictionScoringStatus.PENDING,
    submittedAt: new Date('2026-05-08T10:00:00.000Z'),
    updatedAt: new Date('2026-05-08T10:00:00.000Z'),
    scoredAt: null,
    ...overrides,
  };
}

function createPrismaMock(state: { match: MatchRecord | null; prediction: PredictionRecord; predictions?: PredictionRecord[] }): PrismaMock {
  const predictionList = [...(state.predictions ?? [])];

  return {
    match: {
      findUnique: jest.fn(async (_args: MatchFindUniqueArgs) => state.match),
    },
    prediction: {
      upsert: jest.fn(async ({ create, update }: PredictionUpsertArgs) =>
        state.prediction.id === 'prediction-1'
          ? createPrediction({
              tournamentId: update.tournamentId,
              homeScore: update.homeScore,
              awayScore: update.awayScore,
              pointsAwarded: update.pointsAwarded,
              scoringStatus: update.scoringStatus,
              updatedAt: new Date('2026-05-08T11:00:00.000Z'),
            })
          : createPrediction({
              id: 'prediction-new',
              matchId: create.matchId,
              tournamentId: create.tournamentId,
              homeScore: create.homeScore,
              awayScore: create.awayScore,
              pointsAwarded: create.pointsAwarded,
              scoringStatus: create.scoringStatus,
              submittedAt: new Date('2026-05-08T11:00:00.000Z'),
              updatedAt: new Date('2026-05-08T11:00:00.000Z'),
            }),
      ),
      findMany: jest.fn(async ({ orderBy }: PredictionFindManyArgs) => {
        const sortedPredictions = [...predictionList].sort((left, right) => {
          for (const clause of orderBy) {
            const [field, direction] = Object.entries(clause)[0] as [keyof PredictionRecord, 'asc' | 'desc'];
            const leftValue = left[field];
            const rightValue = right[field];

            if (leftValue === rightValue) {
              continue;
            }

            const leftComparable = leftValue instanceof Date ? leftValue.getTime() : Number(leftValue);
            const rightComparable = rightValue instanceof Date ? rightValue.getTime() : Number(rightValue);
            const comparison = leftComparable > rightComparable ? 1 : -1;
            return direction === 'desc' ? -comparison : comparison;
          }

          return 0;
        });

        return sortedPredictions;
      }),
    },
  };
}

function createUsersServiceMock(user: UserRecord): UsersService {
  return {
    syncAuthenticatedUser: jest.fn(async (_identity: SyncAuthenticatedUserInput) => user),
  } as unknown as UsersService;
}

describe('PredictionsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a prediction before kickoff', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-08T12:00:00.000Z').getTime());
    const prisma = createPrismaMock({ match: createMatch(), prediction: createPrediction({ id: 'prediction-new' }) });
    const usersService = createUsersServiceMock({ id: 'user-1' });
    const service = new PredictionsService(prisma as unknown as PrismaService, usersService);

    const prediction = await service.submitPrediction({
      identity: createIdentity(),
      matchId: 'match-1',
      homeScore: 2,
      awayScore: 1,
    });

    expect(prisma.prediction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-1',
          matchId: 'match-1',
          tournamentId: 'tournament-1',
          homeScore: 2,
          awayScore: 1,
          scoringStatus: PredictionScoringStatus.PENDING,
          pointsAwarded: 0,
        }),
      }),
    );
    expect(prediction).toMatchObject({
      matchId: 'match-1',
      tournamentId: 'tournament-1',
      homeScore: 2,
      awayScore: 1,
      scoringStatus: PredictionScoringStatus.PENDING,
      pointsAwarded: 0,
    });
  });

  it('updates an existing prediction before kickoff', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-08T12:00:00.000Z').getTime());
    const prisma = createPrismaMock({ match: createMatch(), prediction: createPrediction() });
    const usersService = createUsersServiceMock({ id: 'user-1' });
    const service = new PredictionsService(prisma as unknown as PrismaService, usersService);

    const prediction = await service.submitPrediction({
      identity: createIdentity(),
      matchId: 'match-1',
      homeScore: 3,
      awayScore: 2,
    });

    expect(prisma.prediction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          homeScore: 3,
          awayScore: 2,
          scoringStatus: PredictionScoringStatus.PENDING,
          pointsAwarded: 0,
        }),
      }),
    );
    expect(prediction).toMatchObject({
      homeScore: 3,
      awayScore: 2,
      scoringStatus: PredictionScoringStatus.PENDING,
      pointsAwarded: 0,
    });
  });

  it('syncs the authenticated user and returns predictions ordered by updatedAt desc', async () => {
    const identity = createIdentity();
    const prisma = createPrismaMock({
      match: createMatch(),
      prediction: createPrediction(),
      predictions: [
        createPrediction({
          id: 'prediction-1',
          updatedAt: new Date('2026-05-08T10:00:00.000Z'),
          submittedAt: new Date('2026-05-08T09:45:00.000Z'),
        }),
        createPrediction({
          id: 'prediction-2',
          updatedAt: new Date('2026-05-08T12:00:00.000Z'),
          submittedAt: new Date('2026-05-08T11:00:00.000Z'),
        }),
        createPrediction({
          id: 'prediction-3',
          updatedAt: new Date('2026-05-08T13:00:00.000Z'),
          submittedAt: new Date('2026-05-08T12:30:00.000Z'),
        }),
      ],
    });
    const usersService = createUsersServiceMock({ id: 'user-1' });
    const service = new PredictionsService(prisma as unknown as PrismaService, usersService);

    const predictions = await service.getMyPredictions({ identity });

    expect(usersService.syncAuthenticatedUser).toHaveBeenCalledWith(identity);
    expect(prisma.prediction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: [{ updatedAt: 'desc' }, { submittedAt: 'desc' }],
      }),
    );
    expect(predictions).toEqual([
      expect.objectContaining({ id: 'prediction-3', updatedAt: new Date('2026-05-08T13:00:00.000Z') }),
      expect.objectContaining({ id: 'prediction-2', updatedAt: new Date('2026-05-08T12:00:00.000Z') }),
      expect.objectContaining({ id: 'prediction-1', updatedAt: new Date('2026-05-08T10:00:00.000Z') }),
    ]);
  });

  it('returns an empty list when the user has no predictions', async () => {
    const identity = createIdentity();
    const prisma = createPrismaMock({
      match: createMatch(),
      prediction: createPrediction(),
      predictions: [],
    });
    const usersService = createUsersServiceMock({ id: 'user-1' });
    const service = new PredictionsService(prisma as unknown as PrismaService, usersService);

    await expect(service.getMyPredictions({ identity })).resolves.toEqual([]);
    expect(usersService.syncAuthenticatedUser).toHaveBeenCalledWith(identity);
    expect(prisma.prediction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      }),
    );
  });

  it.each([
    ['after kickoff', new Date('2026-05-08T19:00:00.000Z'), MatchStatus.UPCOMING],
    ['non-upcoming match', new Date('2026-05-08T12:00:00.000Z'), MatchStatus.LIVE],
  ])('rejects %s', async (_label, now, status) => {
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    const prisma = createPrismaMock({ match: createMatch({ kickoffAt: new Date('2026-05-08T18:00:00.000Z'), status }), prediction: createPrediction({ id: 'prediction-new' }) });
    const usersService = createUsersServiceMock({ id: 'user-1' });
    const service = new PredictionsService(prisma as unknown as PrismaService, usersService);

    await expect(
      service.submitPrediction({
        identity: createIdentity(),
        matchId: 'match-1',
        homeScore: 1,
        awayScore: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['negative home score', -1, 0],
    ['negative away score', 0, -1],
    ['fractional home score', 1.5, 0],
    ['fractional away score', 0, 2.25],
  ])('rejects %s', async (_label, homeScore, awayScore) => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-08T12:00:00.000Z').getTime());
    const prisma = createPrismaMock({ match: createMatch(), prediction: createPrediction({ id: 'prediction-new' }) });
    const usersService = createUsersServiceMock({ id: 'user-1' });
    const service = new PredictionsService(prisma as unknown as PrismaService, usersService);

    await expect(
      service.submitPrediction({
        identity: createIdentity(),
        matchId: 'match-1',
        homeScore,
        awayScore,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the match is missing', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-08T12:00:00.000Z').getTime());
    const prisma = createPrismaMock({ match: null, prediction: createPrediction({ id: 'prediction-new' }) });
    const usersService = createUsersServiceMock({ id: 'user-1' });
    const service = new PredictionsService(prisma as unknown as PrismaService, usersService);

    await expect(
      service.submitPrediction({
        identity: createIdentity(),
        matchId: 'match-404',
        homeScore: 1,
        awayScore: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
