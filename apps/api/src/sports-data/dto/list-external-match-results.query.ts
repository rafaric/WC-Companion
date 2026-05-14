import { IsIn, IsOptional, IsString } from 'class-validator';

import { EXTERNAL_MATCH_RESULT_STATES, type ExternalMatchResultState } from '../sports-data.constants';

export class ListExternalMatchResultsQueryDto {
  @IsOptional()
  @IsIn(Object.values(EXTERNAL_MATCH_RESULT_STATES))
  state?: ExternalMatchResultState;

  @IsOptional()
  @IsString()
  tournamentId?: string;

  @IsOptional()
  @IsString()
  tournamentSlug?: string;
}
