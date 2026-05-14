import type { AuthenticatedIdentity } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { TournamentsService } from '../tournaments/tournaments.service';
import { UsersService, type CurrentUserProfileView } from './users.service';

interface UserRecord {
  id: string;
  authProvider: string;
  authSubject: string;
  email: string;
  username: string;
  country: string | null;
  favoriteTeamId: string | null;
  avatar: string | null;
  preferredLanguage: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TeamRecord {
  id: string;
}

interface FindUniqueArgs {
  where: {
    authProvider_authSubject: {
      authProvider: string;
      authSubject: string;
    };
  };
  select: Record<string, boolean>;
}

interface CreateArgs {
  data: {
    authProvider: string;
    authSubject: string;
    email: string;
    username: string;
    avatar: string | null;
  };
  select: Record<string, boolean>;
}

interface UpdateArgs {
  where: { id: string };
  data: {
    email?: string;
    avatar?: string | null;
    country?: string;
    favoriteTeamId?: string | null;
    preferredLanguage?: string;
  };
  select: Record<string, boolean>;
}

interface FindFirstTeamArgs {
  where: {
    id: string;
    tournamentId: string;
  };
  select: Record<string, boolean>;
}

interface PrismaUserMock {
  findUnique: jest.Mock<Promise<UserRecord | null>, [FindUniqueArgs]>;
  create: jest.Mock<Promise<UserRecord>, [CreateArgs]>;
  update: jest.Mock<Promise<UserRecord>, [UpdateArgs]>;
}

interface PrismaTeamMock {
  findFirst: jest.Mock<Promise<TeamRecord | null>, [FindFirstTeamArgs]>;
}

interface PrismaMock {
  user: PrismaUserMock;
  team: PrismaTeamMock;
}

interface TournamentsServiceMock {
  getActiveTournament: jest.Mock<Promise<{ id: string }>, []>;
  resolveTournamentContext: jest.Mock<Promise<{ tournament: { id: string; name: string; slug: string; year: number; status: string; startsAt: Date | null; endsAt: Date | null }; source: 'explicit' | 'cookie' | 'active' }>, any[]>;
}

function createIdentity(overrides: Partial<AuthenticatedIdentity> = {}): AuthenticatedIdentity {
  return {
    authSubject: 'auth0|123456789',
    email: 'messi@example.com',
    name: 'Lionel Messi',
    nickname: 'messi',
    picture: 'https://example.com/avatar.png',
    permissions: [],
    ...overrides,
  };
}

function createUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-1',
    authProvider: 'auth0',
    authSubject: 'auth0|123456789',
    email: 'messi@example.com',
    username: 'messi',
    country: null,
    favoriteTeamId: null,
    avatar: 'https://example.com/avatar.png',
    preferredLanguage: 'es',
    createdAt: new Date('2026-05-08T00:00:00.000Z'),
    updatedAt: new Date('2026-05-08T00:00:00.000Z'),
    ...overrides,
  };
}

function createActiveTournament(overrides: Partial<{ id: string }> = {}): { id: string } {
  return {
    id: 'tournament-1',
    ...overrides,
  };
}

function createPrismaMock(state: {
  userByIdentity: UserRecord | null;
  createQueue?: Array<Error | UserRecord>;
  teamById?: TeamRecord | null;
}): PrismaMock {
  const createQueue = [...(state.createQueue ?? [])];

  return {
    user: {
      findUnique: jest.fn(async (_args: FindUniqueArgs) => state.userByIdentity),
      create: jest.fn(async (args: CreateArgs) => {
        const next = createQueue.shift();

        if (next === undefined) {
          return createUser({
            email: args.data.email,
            username: args.data.username,
            avatar: args.data.avatar,
          });
        }

        if (next instanceof Error) {
          throw next;
        }

        return next;
      }),
      update: jest.fn(async ({ where, data }) =>
        createUser({
          id: where.id,
          email: data.email ?? 'messi@example.com',
          avatar: data.avatar ?? null,
          country: data.country ?? null,
          favoriteTeamId: data.favoriteTeamId ?? null,
          preferredLanguage: data.preferredLanguage ?? 'es',
        }),
      ),
    },
    team: {
      findFirst: jest.fn(async ({ where }: FindFirstTeamArgs) =>
        state.teamById !== undefined && state.teamById !== null && state.teamById.id === where.id ? state.teamById : null,
      ),
    },
  };
}

function createTournamentsServiceMock(activeTournament: { id: string } = createActiveTournament()): TournamentsServiceMock {
  return {
    getActiveTournament: jest.fn(async () => activeTournament),
    resolveTournamentContext: jest.fn(async () => ({
      tournament: { id: activeTournament.id, name: 'the active tournament', slug: 'test-tournament', year: 2026, status: 'ACTIVE' as const, startsAt: null, endsAt: null },
      source: 'active' as const,
    })),
  };
}

function createUniqueConstraintError(): Error {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

function createService(prisma: PrismaMock, tournamentsService: TournamentsServiceMock): UsersService {
  return new UsersService(prisma as unknown as PrismaService, tournamentsService as unknown as TournamentsService);
}

describe('UsersService', () => {
  it('creates a user on first sync', async () => {
    const prisma = createPrismaMock({ userByIdentity: null });
    const service = createService(prisma, createTournamentsServiceMock());
    const identity = createIdentity();

    const user = await service.syncAuthenticatedUser(identity);

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authProvider: 'auth0',
          authSubject: identity.authSubject,
          email: identity.email,
          username: 'messi',
          avatar: identity.picture,
        }),
      }),
    );
    expect(user.id).toBe('user-1');
  });

  it('updates email and avatar on subsequent sync without changing id', async () => {
    const existing = createUser({
      id: 'user-existing',
      email: 'placeholder@users.invalid',
      avatar: null,
    });
    const prisma = createPrismaMock({ userByIdentity: existing });
    const service = createService(prisma, createTournamentsServiceMock());
    const identity = createIdentity({
      email: 'messi@fifa.com',
      picture: 'https://example.com/new-avatar.png',
    });

    const user = await service.syncAuthenticatedUser(identity);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-existing' },
        data: {
          email: 'messi@fifa.com',
          avatar: 'https://example.com/new-avatar.png',
        },
      }),
    );
    expect(user.id).toBe('user-existing');
  });

  it('handles username collisions when creating a user', async () => {
    const collisionError = createUniqueConstraintError();
    const prisma = createPrismaMock({
      userByIdentity: null,
      createQueue: [collisionError, createUser({ username: 'messi-2' })],
    });
    const service = createService(prisma, createTournamentsServiceMock());

    const user = await service.syncAuthenticatedUser(createIdentity());

    expect(prisma.user.create).toHaveBeenCalledTimes(2);
    expect(prisma.user.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ username: 'messi' }) }),
    );
    expect(prisma.user.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ username: 'messi-2' }) }),
    );
    expect(user.username).toBe('messi-2');
  });

  it('returns a clean profile view for the current user', async () => {
    const prisma = createPrismaMock({ userByIdentity: null });
    const service = createService(prisma, createTournamentsServiceMock());
    const identity = createIdentity();

    const profile = await service.getCurrentUser(identity);

    const expectedProfile: CurrentUserProfileView = {
      id: 'user-1',
      email: 'messi@example.com',
      username: 'messi',
      country: null,
      favoriteTeamId: null,
      avatar: identity.picture,
      preferredLanguage: 'es',
      createdAt: new Date('2026-05-08T00:00:00.000Z'),
      updatedAt: new Date('2026-05-08T00:00:00.000Z'),
    };

    expect(profile).toEqual(expectedProfile);
  });

  it('updates the current user profile after syncing the user', async () => {
    const existing = createUser({
      id: 'user-existing',
      email: 'placeholder@users.invalid',
      avatar: null,
    });
    const prisma = createPrismaMock({
      userByIdentity: existing,
      teamById: { id: 'team-1' },
    });
    const tournamentsService = createTournamentsServiceMock(createActiveTournament({ id: 'tournament-1' }));
    const service = createService(prisma, tournamentsService);
    const identity = createIdentity({
      email: 'messi@fifa.com',
      picture: 'https://example.com/new-avatar.png',
    });

    const profile = await service.updateCurrentUserProfile(identity, {
      country: 'ar',
      favoriteTeamId: 'team-1',
      preferredLanguage: 'en',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'team-1',
          tournamentId: 'tournament-1',
        },
      }),
    );
    expect(prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'user-existing' },
        data: {
          country: 'AR',
          favoriteTeamId: 'team-1',
          preferredLanguage: 'en',
        },
      }),
    );
    expect(profile).toEqual(
      expect.objectContaining({
        country: 'AR',
        favoriteTeamId: 'team-1',
        preferredLanguage: 'en',
      }),
    );

    const userLookupOrder = prisma.user.findUnique.mock.invocationCallOrder[0];
    const teamLookupOrder = prisma.team.findFirst.mock.invocationCallOrder[0];

    expect(userLookupOrder).toBeDefined();
    expect(teamLookupOrder).toBeDefined();

    if (userLookupOrder !== undefined && teamLookupOrder !== undefined) {
      expect(userLookupOrder).toBeLessThan(teamLookupOrder);
    }
  });

  it('rejects invalid country codes', async () => {
    const prisma = createPrismaMock({ userByIdentity: createUser(), teamById: { id: 'team-1' } });
    const service = createService(prisma, createTournamentsServiceMock());

    await expect(
      service.updateCurrentUserProfile(createIdentity(), {
        country: 'GB-ENG',
        favoriteTeamId: 'team-1',
        preferredLanguage: 'es',
      }),
    ).rejects.toThrow('Country must be an uppercase ISO alpha-2 code');
  });

  it('rejects missing country without throwing a runtime TypeError', async () => {
    const prisma = createPrismaMock({ userByIdentity: createUser(), teamById: { id: 'team-1' } });
    const service = createService(prisma, createTournamentsServiceMock());

    await expect(
      service.updateCurrentUserProfile(createIdentity(), {
        country: undefined,
        favoriteTeamId: 'team-1',
        preferredLanguage: 'es',
      }),
    ).rejects.toThrow('Country is required');
  });

  it('rejects invalid preferred languages', async () => {
    const prisma = createPrismaMock({ userByIdentity: createUser(), teamById: { id: 'team-1' } });
    const service = createService(prisma, createTournamentsServiceMock());

    await expect(
      service.updateCurrentUserProfile(createIdentity(), {
        country: 'AR',
        favoriteTeamId: 'team-1',
        preferredLanguage: 'fr' as 'es' | 'en',
      }),
    ).rejects.toThrow('Preferred language must be one of: es, en');
  });

  it('rejects missing preferred language without throwing a runtime TypeError', async () => {
    const prisma = createPrismaMock({ userByIdentity: createUser(), teamById: { id: 'team-1' } });
    const service = createService(prisma, createTournamentsServiceMock());

    await expect(
      service.updateCurrentUserProfile(createIdentity(), {
        country: 'AR',
        favoriteTeamId: 'team-1',
        preferredLanguage: undefined,
      }),
    ).rejects.toThrow('Preferred language is required');
  });

  it('rejects missing favorite team without throwing a runtime TypeError', async () => {
    const prisma = createPrismaMock({ userByIdentity: createUser(), teamById: { id: 'team-1' } });
    const service = createService(prisma, createTournamentsServiceMock());

    await expect(
      service.updateCurrentUserProfile(createIdentity(), {
        country: 'AR',
        favoriteTeamId: undefined,
        preferredLanguage: 'es',
      }),
    ).rejects.toThrow('Favorite team is required');
  });

  it('rejects missing favorite teams', async () => {
    const prisma = createPrismaMock({ userByIdentity: createUser(), teamById: null });
    const service = createService(prisma, createTournamentsServiceMock());

    await expect(
      service.updateCurrentUserProfile(createIdentity(), {
        country: 'AR',
        favoriteTeamId: 'missing-team',
        preferredLanguage: 'es',
      }),
    ).rejects.toThrow('Favorite team missing-team was not found in tournament the active tournament');
  });
});
