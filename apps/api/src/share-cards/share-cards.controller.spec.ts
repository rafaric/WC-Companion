import { AppModule } from '../app.module';
import { ShareCardsController } from './share-cards.controller';
import { ShareCardsModule } from './share-cards.module';
import type { ShareCardsService } from './share-cards.service';

describe('ShareCards wiring', () => {
  it('compiles the share cards controller and module', () => {
    const service = {
      createMyGlobalRankingShareCard: jest.fn(),
      createGroupRankingShareCard: jest.fn(),
      createPredictionShareCard: jest.fn(),
    } as unknown as ShareCardsService;

    expect(AppModule).toBeDefined();
    expect(ShareCardsModule).toBeDefined();
    expect(new ShareCardsController(service)).toBeInstanceOf(ShareCardsController);
  });
});
