import type { MatchView, PredictionView } from "@/lib/api";

export const SCORING_EXPLANATION_KIND = {
  CORRECT_OUTCOME: "correct-outcome",
  EXACT_SCORE: "exact-score",
  NOT_SCORED: "not-scored",
  WRONG_OUTCOME: "wrong-outcome",
} as const;

export type ScoringExplanationKind = (typeof SCORING_EXPLANATION_KIND)[keyof typeof SCORING_EXPLANATION_KIND];

const MATCH_OUTCOME = {
  AWAY_WIN: "away-win",
  DRAW: "draw",
  HOME_WIN: "home-win",
} as const;

type MatchOutcome = (typeof MATCH_OUTCOME)[keyof typeof MATCH_OUTCOME];

const SCORED_STATUS = "SCORED";

interface ScoreLine {
  homeScore: number;
  awayScore: number;
}

interface MatchWithPrediction extends MatchView {
  prediction: PredictionView | null;
}

export interface ScoringExplanationStrings {
  waitingForScoring: string;
  waitingForScoringDetail: string;
  finalScoreUnavailable: string;
  finalScoreUnavailableDetail: string;
  exactScore: string;
  exactScoreDetail: string;
  correctOutcome: string;
  correctOutcomeDetail: string;
  wrongOutcome: string;
  wrongOutcomeDetail: string;
  homeWin: string;
  awayWin: string;
  draw: string;
  pointUnit: string;
  pointsUnit: string;
}

export interface ScoringExplanation {
  kind: ScoringExplanationKind;
  title: string;
  detail: string;
}

export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  );
}

export function formatPointsLabel(points: number, strings: Pick<ScoringExplanationStrings, "pointUnit" | "pointsUnit">): string {
  const unit = points === 1 ? strings.pointUnit : strings.pointsUnit;
  return `${points} ${unit}`;
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

function formatOutcomeLabel(outcome: MatchOutcome, strings: Pick<ScoringExplanationStrings, "homeWin" | "awayWin" | "draw">): string {
  switch (outcome) {
    case MATCH_OUTCOME.HOME_WIN:
      return strings.homeWin;
    case MATCH_OUTCOME.AWAY_WIN:
      return strings.awayWin;
    case MATCH_OUTCOME.DRAW:
      return strings.draw;
  }
}

function getActualScoreLine(match: MatchView): ScoreLine | null {
  if (match.homeScore === null || match.awayScore === null) {
    return null;
  }

  return {
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  };
}

function getPredictionScoreLine(prediction: PredictionView): ScoreLine {
  return {
    homeScore: prediction.homeScore,
    awayScore: prediction.awayScore,
  };
}

export function getScoringExplanation(match: MatchWithPrediction, strings: ScoringExplanationStrings): ScoringExplanation | null {
  if (!match.prediction) {
    return null;
  }

  if (match.prediction.scoringStatus !== SCORED_STATUS) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: strings.waitingForScoring,
      detail: strings.waitingForScoringDetail,
    };
  }

  const actualScore = getActualScoreLine(match);

  if (!actualScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: strings.finalScoreUnavailable,
      detail: strings.finalScoreUnavailableDetail,
    };
  }

  const predictionScore = getPredictionScoreLine(match.prediction);
  const exactScore =
    predictionScore.homeScore === actualScore.homeScore && predictionScore.awayScore === actualScore.awayScore;

  if (exactScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.EXACT_SCORE,
      title: strings.exactScore,
      detail: formatTemplate(strings.exactScoreDetail, {
        points: formatPointsLabel(match.prediction.pointsAwarded, strings),
      }),
    };
  }

  const predictedOutcome = resolveOutcome(predictionScore);
  const actualOutcome = resolveOutcome(actualScore);

  if (predictedOutcome === actualOutcome) {
    return {
      kind: SCORING_EXPLANATION_KIND.CORRECT_OUTCOME,
      title: strings.correctOutcome,
      detail: formatTemplate(strings.correctOutcomeDetail, {
        predictedOutcome: formatOutcomeLabel(predictedOutcome, strings),
        actualOutcome: formatOutcomeLabel(actualOutcome, strings),
      }),
    };
  }

  return {
    kind: SCORING_EXPLANATION_KIND.WRONG_OUTCOME,
    title: strings.wrongOutcome,
    detail: formatTemplate(strings.wrongOutcomeDetail, {
      predictedOutcome: formatOutcomeLabel(predictedOutcome, strings),
      actualOutcome: formatOutcomeLabel(actualOutcome, strings),
    }),
  };
}

export function getScoringExplanationClassName(kind: ScoringExplanationKind): string {
  switch (kind) {
    case SCORING_EXPLANATION_KIND.EXACT_SCORE:
      return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
    case SCORING_EXPLANATION_KIND.CORRECT_OUTCOME:
      return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
    case SCORING_EXPLANATION_KIND.WRONG_OUTCOME:
      return "border-rose-300/30 bg-rose-300/10 text-rose-100";
    case SCORING_EXPLANATION_KIND.NOT_SCORED:
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
}
