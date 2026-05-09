export const MATCH_OUTCOME = {
  HOME_WIN: 'home-win',
  AWAY_WIN: 'away-win',
  DRAW: 'draw',
} as const;

export type MatchOutcome = (typeof MATCH_OUTCOME)[keyof typeof MATCH_OUTCOME];

export const SCORING_RESULT_KIND = {
  EXACT: 'exact',
  CORRECT_WINNER: 'correct-winner',
  CORRECT_DRAW: 'correct-draw',
  WRONG: 'wrong',
} as const;

export type ScoringResultKind =
  (typeof SCORING_RESULT_KIND)[keyof typeof SCORING_RESULT_KIND];

export interface ScoreLine {
  homeScore: number;
  awayScore: number;
}

export interface ScoringRule {
  exactScore: number;
  correctSide: number;
  wrongResult: number;
}

export interface ScorePredictionInput {
  prediction: ScoreLine;
  actual: ScoreLine;
  rule: ScoringRule;
}

export interface ScorePredictionResult {
  points: number;
  kind: ScoringResultKind;
  predictedOutcome: MatchOutcome;
  actualOutcome: MatchOutcome;
}

function resolveOutcome(score: ScoreLine): MatchOutcome {
  if (score.homeScore > score.awayScore) {
    return MATCH_OUTCOME.HOME_WIN;
  }

  if (score.homeScore < score.awayScore) {
    return MATCH_OUTCOME.AWAY_WIN;
  }

  return MATCH_OUTCOME.DRAW;
}

function isExactScore(prediction: ScoreLine, actual: ScoreLine): boolean {
  return prediction.homeScore === actual.homeScore && prediction.awayScore === actual.awayScore;
}

export function scorePrediction(input: ScorePredictionInput): ScorePredictionResult {
  const predictedOutcome = resolveOutcome(input.prediction);
  const actualOutcome = resolveOutcome(input.actual);

  if (isExactScore(input.prediction, input.actual)) {
    return {
      points: input.rule.exactScore,
      kind: SCORING_RESULT_KIND.EXACT,
      predictedOutcome,
      actualOutcome,
    };
  }

  if (predictedOutcome === actualOutcome) {
    return {
      points: input.rule.correctSide,
      kind:
        actualOutcome === MATCH_OUTCOME.DRAW
          ? SCORING_RESULT_KIND.CORRECT_DRAW
          : SCORING_RESULT_KIND.CORRECT_WINNER,
      predictedOutcome,
      actualOutcome,
    };
  }

  return {
    points: input.rule.wrongResult,
    kind: SCORING_RESULT_KIND.WRONG,
    predictedOutcome,
    actualOutcome,
  };
}
