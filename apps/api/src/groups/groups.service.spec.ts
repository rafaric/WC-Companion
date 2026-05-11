import { GroupRole } from '@prisma/client';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { TournamentsService } from '../tournaments/tournaments.service';
import type { UsersService } from '../users/users.service';
import { GroupsService, type GroupView, type MyGroupView } from './groups.service';

interface GroupRecord {
  id: string;
  tournamentId: string;
  ownerId: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
}

interface MembershipRecord {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: Date;
  group: GroupRecord;
}

interface GroupCreateArgs {
  data: {
    tournamentId: string;
    ownerId: string;
    name: string;
    inviteCode: string;
  };
  select: Record<string, boolean>;
}

interface GroupFindUniqueArgs {
  where: {
    inviteCode: string;
  };
  select: Record<string, boolean>;
}

interface MembershipCreateArgs {
  data: {
    groupId: string;
    userId: string;
    role: GroupRole;
  };
}

interface MembershipFindFirstArgs {
  where: {
    groupId: string;
    userId: string;
  };
  select: {
    role: boolean;
  };
}

interface MembershipFindManyArgs {
  where: {
    userId: string;
  };
  orderBy: {
    joinedAt: 'desc';
  };
  select: {
    role: boolean;
    group: {
      select: Record<string, boolean>;
    };
  };
}

interface MembershipCountArgs {
  where: {
    groupId: string;
  };
}

interface PrismaMock {
  group: {
    findUnique: jest.Mock<Promise<GroupRecord | null>, [GroupFindUniqueArgs]>;
    create: jest.Mock<Promise<GroupRecord>, [GroupCreateArgs]>;
  };
  groupMembership: {
    findFirst: jest.Mock<Promise<{ role: GroupRole } | null>, [MembershipFindFirstArgs]>;
    create: jest.Mock<Promise<MembershipRecord>, [MembershipCreateArgs]>;
    findMany: jest.Mock<Promise<Array<{ role: GroupRole; group: GroupRecord }>>, [MembershipFindManyArgs]>;
    count: jest.Mock<Promise<number>, [MembershipCountArgs]>;
  };
  $transaction: <T>(callback: (transaction: PrismaMock) => Promise<T>) => Promise<T>;
}

interface UsersServiceMock {
  syncAuthenticatedUser: jest.Mock<Promise<{ id: string }>, [AuthenticatedIdentity]>;
}

interface TournamentsServiceMock {
  getActiveTournament: jest.Mock<Promise<{ id: string }>, []>;
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

function createGroup(overrides: Partial<GroupRecord> = {}): GroupRecord {
  return {
    id: 'group-1',
    tournamentId: 'tournament-1',
    ownerId: 'user-1',
    name: 'Friends of Messi',
    inviteCode: 'ABC123XYZ789',
    createdAt: new Date('2026-05-08T00:00:00.000Z'),
    ...overrides,
  };
}

function createMembership(overrides: Partial<MembershipRecord> = {}): MembershipRecord {
  const group = overrides.group ?? createGroup({ id: overrides.groupId ?? 'group-1' });

  return {
    id: 'membership-1',
    groupId: group.id,
    userId: 'user-1',
    role: GroupRole.MEMBER,
    joinedAt: new Date('2026-05-08T01:00:00.000Z'),
    group,
    ...overrides,
  };
}

function createPrismaMock(state: {
  groups: GroupRecord[];
  memberships: MembershipRecord[];
  createQueue?: Array<Error | GroupRecord>;
}): PrismaMock {
  const createQueue = [...(state.createQueue ?? [])];

  let prisma: PrismaMock;

  const $transaction: PrismaMock['$transaction'] = async <T>(callback: (transaction: PrismaMock) => Promise<T>): Promise<T> =>
    callback(prisma);

  prisma = {
    group: {
      findUnique: jest.fn(async ({ where }) => state.groups.find((group) => group.inviteCode === where.inviteCode) ?? null),
      create: jest.fn(async (args) => {
        const next = createQueue.shift();

        if (next instanceof Error) {
          throw next;
        }

        const created =
          next ??
          createGroup({
            tournamentId: args.data.tournamentId,
            ownerId: args.data.ownerId,
            name: args.data.name,
            inviteCode: args.data.inviteCode,
          });

        state.groups.push(created);
        return created;
      }),
    },
    groupMembership: {
      findFirst: jest.fn(async ({ where }) =>
        state.memberships.find((membership) => membership.groupId === where.groupId && membership.userId === where.userId) ?? null,
      ),
      create: jest.fn(async ({ data }) => {
        const group = state.groups.find((entry) => entry.id === data.groupId);

        if (group === undefined) {
          throw new Error(`Group ${data.groupId} not found`);
        }

        const membership = createMembership({
          group,
          groupId: group.id,
          userId: data.userId,
          role: data.role,
        });

        state.memberships.push(membership);
        return membership;
      }),
      findMany: jest.fn(async ({ where }) =>
        state.memberships
          .filter((membership) => membership.userId === where.userId)
          .sort((left, right) => right.joinedAt.getTime() - left.joinedAt.getTime())
          .map((membership) => ({ role: membership.role, group: membership.group })),
      ),
      count: jest.fn(async ({ where }) => state.memberships.filter((membership) => membership.groupId === where.groupId).length),
    },
    $transaction,
  };

  return prisma;
}

function createUsersServiceMock(userId = 'user-1'): UsersServiceMock {
  return {
    syncAuthenticatedUser: jest.fn(async (_identity: AuthenticatedIdentity) => ({ id: userId })),
  };
}

function createTournamentsServiceMock(tournamentId = 'tournament-1'): TournamentsServiceMock {
  return {
    getActiveTournament: jest.fn(async () => ({ id: tournamentId })),
  };
}

function createService(prisma: PrismaMock, usersService: UsersServiceMock, tournamentsService: TournamentsServiceMock): GroupsService {
  return new GroupsService(prisma as unknown as PrismaService, usersService as unknown as UsersService, tournamentsService as unknown as TournamentsService);
}

function createUniqueConstraintError(): Error {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

describe('GroupsService', () => {
  it('creates a group and owner membership', async () => {
    const prisma = createPrismaMock({ groups: [], memberships: [] });
    const usersService = createUsersServiceMock();
    const tournamentsService = createTournamentsServiceMock();
    const service = createService(prisma, usersService, tournamentsService);

    const result = await service.createGroup({
      identity: createIdentity(),
      name: ' Friends of Messi ',
    });

    expect(usersService.syncAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(tournamentsService.getActiveTournament).toHaveBeenCalledTimes(1);
    expect(prisma.group.create).toHaveBeenCalledTimes(1);
    expect(prisma.groupMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          groupId: result.id,
          userId: 'user-1',
          role: GroupRole.OWNER,
        },
      }),
    );
    expect(result.name).toBe('Friends of Messi');
    expect(result.tournamentId).toBe('tournament-1');
    expect(result.memberCount).toBe(1);
  });

  it('retries invite code generation after a unique collision', async () => {
    const firstError = createUniqueConstraintError();
    const secondAttempt = createGroup({ id: 'group-collision-2', inviteCode: 'BBBB22222222' });
    const prisma = createPrismaMock({
      groups: [],
      memberships: [],
      createQueue: [firstError, secondAttempt],
    });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());

    const result = await service.createGroup({
      identity: createIdentity(),
      name: 'Friends',
    });

    expect(prisma.group.create).toHaveBeenCalledTimes(2);
    expect(result.inviteCode).toBe(secondAttempt.inviteCode);
  });

  it('rejects missing group names without throwing a runtime TypeError', async () => {
    const prisma = createPrismaMock({ groups: [], memberships: [] });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());

    await expect(
      service.createGroup({
        identity: createIdentity(),
        name: undefined,
      }),
    ).rejects.toThrow('Group name is required');
  });

  it('joins a group as a member', async () => {
    const group = createGroup();
    const prisma = createPrismaMock({ groups: [group], memberships: [] });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());

    const result = await service.joinGroup({
      identity: createIdentity(),
      inviteCode: group.inviteCode,
    });

    expect(prisma.groupMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          groupId: group.id,
          userId: 'user-1',
          role: GroupRole.MEMBER,
        },
      }),
    );
    expect(result).toEqual<GroupView>({
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      tournamentId: group.tournamentId,
      createdAt: group.createdAt,
      memberCount: 1,
    });
  });

  it('does not duplicate membership when the user is already a member', async () => {
    const group = createGroup();
    const membership = createMembership({ group, role: GroupRole.MEMBER });
    const prisma = createPrismaMock({ groups: [group], memberships: [membership] });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());

    const result = await service.joinGroup({
      identity: createIdentity(),
      inviteCode: group.inviteCode,
    });

    expect(prisma.groupMembership.create).not.toHaveBeenCalled();
    expect(result.inviteCode).toBe(group.inviteCode);
    expect(result.memberCount).toBe(1);
  });

  it('rejects unknown invite codes', async () => {
    const prisma = createPrismaMock({ groups: [], memberships: [] });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());

    await expect(
      service.joinGroup({
        identity: createIdentity(),
        inviteCode: 'MISSING-CODE',
      }),
    ).rejects.toThrow('was not found');
  });

  it('rejects missing invite codes without throwing a runtime TypeError', async () => {
    const prisma = createPrismaMock({ groups: [], memberships: [] });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());

    await expect(
      service.joinGroup({
        identity: createIdentity(),
        inviteCode: undefined,
      }),
    ).rejects.toThrow('Invite code is required');
  });

  it('lists my groups with membership roles', async () => {
    const firstGroup = createGroup({ id: 'group-1', inviteCode: 'GROUPONE1234', name: 'Group One' });
    const secondGroup = createGroup({ id: 'group-2', inviteCode: 'GROUPTWO5678', name: 'Group Two' });
    const prisma = createPrismaMock({
      groups: [firstGroup, secondGroup],
      memberships: [
        createMembership({ id: 'membership-1', group: firstGroup, groupId: firstGroup.id, role: GroupRole.OWNER }),
        createMembership({ id: 'membership-2', group: secondGroup, groupId: secondGroup.id, role: GroupRole.MEMBER }),
      ],
    });
    const service = createService(prisma, createUsersServiceMock(), createTournamentsServiceMock());

    const result = await service.getMyGroups({ identity: createIdentity() });

    expect(result).toEqual<MyGroupView[]>([
      {
        role: GroupRole.OWNER,
        id: firstGroup.id,
        name: firstGroup.name,
        inviteCode: firstGroup.inviteCode,
        tournamentId: firstGroup.tournamentId,
        createdAt: firstGroup.createdAt,
        memberCount: 1,
      },
      {
        role: GroupRole.MEMBER,
        id: secondGroup.id,
        name: secondGroup.name,
        inviteCode: secondGroup.inviteCode,
        tournamentId: secondGroup.tournamentId,
        createdAt: secondGroup.createdAt,
        memberCount: 1,
      },
    ]);
  });
});
