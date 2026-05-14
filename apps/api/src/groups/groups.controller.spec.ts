import type { AuthenticatedIdentity } from '../auth/auth.types';
import type { RankingEntryView, RankingsService } from '../rankings/rankings.service';
import { GroupsController } from './groups.controller';
import type { GroupsService } from './groups.service';

describe('GroupsController', () => {
  const identity: AuthenticatedIdentity = {
    authSubject: 'auth0|123456789',
    email: 'messi@example.com',
    name: 'Lionel Messi',
    nickname: 'messi',
    picture: null,
    permissions: [],
  };

  it('delegates group ranking lookup to the rankings service', async () => {
    const ranking: RankingEntryView[] = [
      {
        position: 1,
        userId: 'user-1',
        username: 'messi',
        avatar: null,
        country: 'AR',
        favoriteTeamId: 'team-1',
        totalPoints: 12,
        exactPredictions: 4,
        predictionsCount: 4,
        lastScoredAt: null,
        updatedAt: new Date('2026-05-08T00:00:00.000Z'),
      },
    ];

    const groupsService = {
      getMyGroups: jest.fn(),
      createGroup: jest.fn(),
      joinGroup: jest.fn(),
    } as unknown as GroupsService;
    const rankingsService = {
      getGroupRanking: jest.fn(async () => ranking),
    } as unknown as RankingsService;
    const controller = new GroupsController(groupsService, rankingsService);

    await expect(controller.getGroupRanking(identity, 'group-1')).resolves.toEqual(ranking);
    expect(rankingsService.getGroupRanking).toHaveBeenCalledWith({
      identity,
      groupId: 'group-1',
    });
  });

  describe('tournament context plumbing', () => {
    it('passes tournament context to createGroup', async () => {
      const groupsService = {
        createGroup: jest.fn(async () => ({ id: 'group-1', name: 'Test Group', inviteCode: 'ABC123', tournamentId: 'tournament-1', createdAt: new Date(), memberCount: 1 })),
        joinGroup: jest.fn(),
        getMyGroups: jest.fn(),
      } as unknown as GroupsService;
      const rankingsService = {} as unknown as RankingsService;
      const controller = new GroupsController(groupsService, rankingsService);

      const body = { name: 'Test Group' };
      const query = { tournamentId: 'tournament-123', tournamentSlug: 'world-cup-2026' };

      await controller.createGroup(identity, body, query);

      expect(groupsService.createGroup).toHaveBeenCalledWith({
        identity,
        name: body.name,
        tournamentContext: {
          explicitTournamentId: 'tournament-123',
          selectedSlug: 'world-cup-2026',
        },
      });
    });

    it('passes tournament context to getMyGroups', async () => {
      const groupsService = {
        createGroup: jest.fn(),
        joinGroup: jest.fn(),
        getMyGroups: jest.fn(async () => []),
      } as unknown as GroupsService;
      const rankingsService = {} as unknown as RankingsService;
      const controller = new GroupsController(groupsService, rankingsService);

      const query = { tournamentId: 'tournament-456', tournamentSlug: null };

      await controller.getMyGroups(identity, query);

      expect(groupsService.getMyGroups).toHaveBeenCalledWith({
        identity,
        tournamentContext: {
          explicitTournamentId: 'tournament-456',
          selectedSlug: null,
        },
      });
    });

    it('passes empty tournament context when query is empty', async () => {
      const groupsService = {
        createGroup: jest.fn(async () => ({ id: 'group-1', name: 'Test Group', inviteCode: 'ABC123', tournamentId: 'tournament-1', createdAt: new Date(), memberCount: 1 })),
        joinGroup: jest.fn(),
        getMyGroups: jest.fn(async () => []),
      } as unknown as GroupsService;
      const rankingsService = {} as unknown as RankingsService;
      const controller = new GroupsController(groupsService, rankingsService);

      // Test createGroup with empty query
      await controller.createGroup(identity, { name: 'Test Group' }, {});

      expect(groupsService.createGroup).toHaveBeenCalledWith({
        identity,
        name: 'Test Group',
        tournamentContext: {
          explicitTournamentId: undefined,
          selectedSlug: undefined,
        },
      });
    });
  });
});
