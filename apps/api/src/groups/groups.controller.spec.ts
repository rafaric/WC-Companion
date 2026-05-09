import type { AuthenticatedIdentity } from '../auth/auth.types';
import type { RankingEntryView, RankingsService } from '../rankings/rankings.service';
import { GroupsController } from './groups.controller';
import type { GroupsService } from './groups.service';

describe('GroupsController', () => {
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
    const identity: AuthenticatedIdentity = {
      authSubject: 'auth0|123456789',
      email: 'messi@example.com',
      name: 'Lionel Messi',
      nickname: 'messi',
      picture: null,
      permissions: [],
    };

    await expect(controller.getGroupRanking(identity, 'group-1')).resolves.toEqual(ranking);
    expect(rankingsService.getGroupRanking).toHaveBeenCalledWith({
      identity,
      groupId: 'group-1',
    });
  });
});
