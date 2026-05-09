import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';

import { Auth0JwtGuard } from '../auth/auth.guard';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedIdentity } from '../auth/auth.types';
import { SubmitPredictionDto } from './dto/submit-prediction.dto';
import { PredictionsService } from './predictions.service';

@UseGuards(Auth0JwtGuard)
@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get('me')
  async getMyPredictions(@CurrentAuthUser() identity: AuthenticatedIdentity) {
    return this.predictionsService.getMyPredictions({ identity });
  }

  @Put('matches/:matchId')
  async submitPrediction(
    @CurrentAuthUser() identity: AuthenticatedIdentity,
    @Param('matchId') matchId: string,
    @Body() body: SubmitPredictionDto,
  ) {
    return this.predictionsService.submitPrediction({
      identity,
      matchId,
      homeScore: body.homeScore,
      awayScore: body.awayScore,
    });
  }
}
