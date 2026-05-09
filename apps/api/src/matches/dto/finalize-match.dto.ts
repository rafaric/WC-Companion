export class FinalizeMatchDto {
  homeScore!: number;

  awayScore!: number;
}

export interface FinalizeMatchInput {
  matchId: string;
  homeScore: number;
  awayScore: number;
}
