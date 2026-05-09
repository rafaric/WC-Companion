import { IsInt, Min } from 'class-validator';

export class FinalizeMatchDto {
  @IsInt()
  @Min(0)
  homeScore!: number;

  @IsInt()
  @Min(0)
  awayScore!: number;
}

export interface FinalizeMatchInput {
  matchId: string;
  homeScore: unknown;
  awayScore: unknown;
}
