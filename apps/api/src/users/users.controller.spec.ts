import type { AuthenticatedIdentity } from '../auth/auth.types';
import { UpdateCurrentUserProfileDto } from './dto/update-current-user-profile.dto';
import { UsersController } from './users.controller';
import type { CurrentUserProfileView, UsersService } from './users.service';

describe('UsersController', () => {
  it('delegates current user lookup to the service', async () => {
    const profile: CurrentUserProfileView = {
      id: 'user-1',
      email: 'messi@example.com',
      username: 'messi',
      country: null,
      favoriteTeamId: null,
      avatar: null,
      preferredLanguage: 'es',
      createdAt: new Date('2026-05-08T00:00:00.000Z'),
      updatedAt: new Date('2026-05-08T00:00:00.000Z'),
    };

    const usersService = {
      getCurrentUser: jest.fn(async () => profile),
    } as unknown as UsersService;
    const controller = new UsersController(usersService);
    const identity: AuthenticatedIdentity = {
      authSubject: 'auth0|123456789',
      email: 'messi@example.com',
      name: 'Lionel Messi',
      nickname: 'messi',
      picture: null,
      permissions: [],
    };

    await expect(controller.getCurrentUser(identity)).resolves.toEqual(profile);
    expect(usersService.getCurrentUser).toHaveBeenCalledWith(identity);
  });

  it('delegates profile updates to the service with tournament context', async () => {
    const profile: CurrentUserProfileView = {
      id: 'user-1',
      email: 'messi@example.com',
      username: 'messi',
      country: 'AR',
      favoriteTeamId: 'team-1',
      avatar: null,
      preferredLanguage: 'es',
      createdAt: new Date('2026-05-08T00:00:00.000Z'),
      updatedAt: new Date('2026-05-08T00:00:00.000Z'),
    };

    const usersService = {
      updateCurrentUserProfile: jest.fn(async () => profile),
    } as unknown as UsersService;
    const controller = new UsersController(usersService);
    const identity: AuthenticatedIdentity = {
      authSubject: 'auth0|123456789',
      email: 'messi@example.com',
      name: 'Lionel Messi',
      nickname: 'messi',
      picture: null,
      permissions: [],
    };
    const body: UpdateCurrentUserProfileDto = {
      country: 'AR',
      favoriteTeamId: 'team-1',
      preferredLanguage: 'es',
    };
    const query = { tournamentId: 'tournament-123', tournamentSlug: null };

    await expect(controller.updateCurrentUserProfile(identity, body, query)).resolves.toEqual(profile);
    expect(usersService.updateCurrentUserProfile).toHaveBeenCalledWith(identity, {
      ...body,
      tournamentContext: {
        explicitTournamentId: 'tournament-123',
        selectedSlug: null,
      },
    });
  });
});
