import type { AuthenticatedIdentity } from '../auth/auth.types';
import { ShareCardsController } from './share-cards.controller';
import type { ShareCardView, ShareCardsService } from './share-cards.service';

describe('ShareCardsController', () => {
  const identity: AuthenticatedIdentity = {
    authSubject: 'auth0|123456789',
    email: 'messi@example.com',
    name: 'Lionel Messi',
    nickname: 'messi',
    picture: null,
    permissions: [],
  };

  it('compiles the share cards controller', () => {
    const service = {
      createMyGlobalRankingShareCard: jest.fn(),
      createGroupRankingShareCard: jest.fn(),
      createPredictionShareCard: jest.fn(),
    } as unknown as ShareCardsService;

    expect(new ShareCardsController(service)).toBeInstanceOf(ShareCardsController);
  });

  describe('tournament context plumbing', () => {
    it('passes tournament context to createMyGlobalRankingShareCard', async () => {
      const shareCard: ShareCardView = {
        id: 'card-1',
        type: 'PERFORMANCE_SUMMARY' as any,
        imageUrl: null,
        payload: {
          cardType: 'PERFORMANCE_SUMMARY',
          tournamentName: 'World Cup 2026',
          tournamentYear: 2026,
          username: 'messi',
          country: 'AR',
          avatar: null,
          position: 1,
          totalPoints: 12,
          exactPredictions: 4,
          predictionsCount: 4,
          generatedAt: '2026-05-13T00:00:00.000Z',
        },
        createdAt: new Date(),
      };

      const shareCardsService = {
        createMyGlobalRankingShareCard: jest.fn(async () => shareCard),
        createGroupRankingShareCard: jest.fn(),
        createPredictionShareCard: jest.fn(),
      } as unknown as ShareCardsService;
      const controller = new ShareCardsController(shareCardsService);

      const query = { tournamentId: 'tournament-123', tournamentSlug: 'world-cup-2026' };

      await controller.createMyGlobalRankingShareCard(identity, query);

      expect(shareCardsService.createMyGlobalRankingShareCard).toHaveBeenCalledWith(identity, {
        explicitTournamentId: 'tournament-123',
        selectedSlug: 'world-cup-2026',
      });
    });

    it('passes empty tournament context when query is empty', async () => {
      const shareCard: ShareCardView = {
        id: 'card-1',
        type: 'PERFORMANCE_SUMMARY' as any,
        imageUrl: null,
        payload: {
          cardType: 'PERFORMANCE_SUMMARY',
          tournamentName: 'World Cup 2026',
          tournamentYear: 2026,
          username: 'messi',
          country: 'AR',
          avatar: null,
          position: 1,
          totalPoints: 12,
          exactPredictions: 4,
          predictionsCount: 4,
          generatedAt: '2026-05-13T00:00:00.000Z',
        },
        createdAt: new Date(),
      };

      const shareCardsService = {
        createMyGlobalRankingShareCard: jest.fn(async () => shareCard),
        createGroupRankingShareCard: jest.fn(),
        createPredictionShareCard: jest.fn(),
      } as unknown as ShareCardsService;
      const controller = new ShareCardsController(shareCardsService);

      await controller.createMyGlobalRankingShareCard(identity, {});

      expect(shareCardsService.createMyGlobalRankingShareCard).toHaveBeenCalledWith(identity, {
        explicitTournamentId: undefined,
        selectedSlug: undefined,
      });
    });
  });
});
