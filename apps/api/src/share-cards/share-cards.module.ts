import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { UsersModule } from '../users/users.module';
import { ShareCardsController } from './share-cards.controller';
import { ShareCardsService } from './share-cards.service';

@Module({
  imports: [AuthModule, PrismaModule, TournamentsModule, UsersModule],
  controllers: [ShareCardsController],
  providers: [ShareCardsService],
  exports: [ShareCardsService],
})
export class ShareCardsModule {}
