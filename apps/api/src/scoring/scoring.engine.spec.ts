import { scorePrediction, MATCH_OUTCOME, SCORING_RESULT_KIND } from './scoring.engine';

const DEFAULT_RULE = {
  exactScore: 3,
  correctSide: 1,
  wrongResult: 0,
} as const;

describe('scorePrediction', () => {
  it('awards exact score points for a home win', () => {
    const result = scorePrediction({
      prediction: { homeScore: 2, awayScore: 1 },
      actual: { homeScore: 2, awayScore: 1 },
      rule: DEFAULT_RULE,
    });

    expect(result).toEqual({
      points: 3,
      kind: SCORING_RESULT_KIND.EXACT,
      predictedOutcome: MATCH_OUTCOME.HOME_WIN,
      actualOutcome: MATCH_OUTCOME.HOME_WIN,
    });
  });

  it('awards exact score points for a draw', () => {
    const result = scorePrediction({
      prediction: { homeScore: 1, awayScore: 1 },
      actual: { homeScore: 1, awayScore: 1 },
      rule: DEFAULT_RULE,
    });

    expect(result).toEqual({
      points: 3,
      kind: SCORING_RESULT_KIND.EXACT,
      predictedOutcome: MATCH_OUTCOME.DRAW,
      actualOutcome: MATCH_OUTCOME.DRAW,
    });
  });

  it('awards correct winner points when the home win is right but not exact', () => {
    const result = scorePrediction({
      prediction: { homeScore: 2, awayScore: 0 },
      actual: { homeScore: 3, awayScore: 1 },
      rule: DEFAULT_RULE,
    });

    expect(result).toEqual({
      points: 1,
      kind: SCORING_RESULT_KIND.CORRECT_WINNER,
      predictedOutcome: MATCH_OUTCOME.HOME_WIN,
      actualOutcome: MATCH_OUTCOME.HOME_WIN,
    });
  });

  it('awards correct draw points when the draw is right but not exact', () => {
    const result = scorePrediction({
      prediction: { homeScore: 0, awayScore: 0 },
      actual: { homeScore: 1, awayScore: 1 },
      rule: DEFAULT_RULE,
    });

    expect(result).toEqual({
      points: 1,
      kind: SCORING_RESULT_KIND.CORRECT_DRAW,
      predictedOutcome: MATCH_OUTCOME.DRAW,
      actualOutcome: MATCH_OUTCOME.DRAW,
    });
  });

  it('awards zero points for a wrong prediction', () => {
    const result = scorePrediction({
      prediction: { homeScore: 0, awayScore: 2 },
      actual: { homeScore: 1, awayScore: 0 },
      rule: DEFAULT_RULE,
    });

    expect(result).toEqual({
      points: 0,
      kind: SCORING_RESULT_KIND.WRONG,
      predictedOutcome: MATCH_OUTCOME.AWAY_WIN,
      actualOutcome: MATCH_OUTCOME.HOME_WIN,
    });
  });

  it('awards exact score points for an away win', () => {
    const result = scorePrediction({
      prediction: { homeScore: 0, awayScore: 2 },
      actual: { homeScore: 0, awayScore: 2 },
      rule: DEFAULT_RULE,
    });

    expect(result).toEqual({
      points: 3,
      kind: SCORING_RESULT_KIND.EXACT,
      predictedOutcome: MATCH_OUTCOME.AWAY_WIN,
      actualOutcome: MATCH_OUTCOME.AWAY_WIN,
    });
  });

  it('awards correct winner points for an away win when not exact', () => {
    const result = scorePrediction({
      prediction: { homeScore: 1, awayScore: 3 },
      actual: { homeScore: 0, awayScore: 1 },
      rule: DEFAULT_RULE,
    });

    expect(result).toEqual({
      points: 1,
      kind: SCORING_RESULT_KIND.CORRECT_WINNER,
      predictedOutcome: MATCH_OUTCOME.AWAY_WIN,
      actualOutcome: MATCH_OUTCOME.AWAY_WIN,
    });
  });

  it('uses custom scoring rule values', () => {
    const result = scorePrediction({
      prediction: { homeScore: 4, awayScore: 2 },
      actual: { homeScore: 4, awayScore: 2 },
      rule: {
        exactScore: 10,
        correctSide: 4,
        wrongResult: -1,
      },
    });

    expect(result).toEqual({
      points: 10,
      kind: SCORING_RESULT_KIND.EXACT,
      predictedOutcome: MATCH_OUTCOME.HOME_WIN,
      actualOutcome: MATCH_OUTCOME.HOME_WIN,
    });
  });
});
