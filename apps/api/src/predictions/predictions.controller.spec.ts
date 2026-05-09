import { PredictionScoringStatus } from '@prisma/client';

import type { AuthenticatedIdentity } from '../auth/auth.types';
import { PredictionsController } from './predictions.controller';
import type { PredictionView, PredictionsService } from './predictions.service';

describe('PredictionsController', () => {
  it('delegates my predictions lookup to the service', async () => {
    const predictions: PredictionView[] = [
      {
        id: 'prediction-1',
        matchId: 'match-1',
        tournamentId: 'tournament-1',
        homeScore: 2,
        awayScore: 1,
        pointsAwarded: 3,
        scoringStatus: PredictionScoringStatus.PENDING,
        submittedAt: new Date('2026-05-08T10:00:00.000Z'),
        updatedAt: new Date('2026-05-08T10:00:00.000Z'),
        scoredAt: null,
      },
    ];

    const predictionsService = {
      getMyPredictions: jest.fn(async () => predictions),
    } as unknown as PredictionsService;
    const controller = new PredictionsController(predictionsService);
    const identity: AuthenticatedIdentity = {
      authSubject: 'auth0|123456789',
      email: 'messi@example.com',
      name: 'Lionel Messi',
      nickname: 'messi',
      picture: null,
      permissions: [],
    };

    await expect(controller.getMyPredictions(identity)).resolves.toEqual(predictions);
    expect(predictionsService.getMyPredictions).toHaveBeenCalledWith({ identity });
  });
});
