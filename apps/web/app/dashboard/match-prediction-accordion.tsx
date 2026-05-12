"use client";

import { useState } from "react";

import type { MatchView, PredictionView } from "@/lib/api";

interface MatchPredictionCard extends MatchView {
  prediction: PredictionView | null;
}

interface MatchPredictionAccordionProps {
  matches: MatchPredictionCard[];
  profileComplete: boolean;
  submitPredictionAction: (matchId: string, formData: FormData) => Promise<void>;
}

const MATCH_OUTCOME = {
  AWAY_WIN: "away-win",
  DRAW: "draw",
  HOME_WIN: "home-win",
} as const;

type MatchOutcome = (typeof MATCH_OUTCOME)[keyof typeof MATCH_OUTCOME];

const CLIENT_MATCH_STATUS = {
  FINISHED: "FINISHED",
  UPCOMING: "UPCOMING",
} as const;

const CLIENT_PREDICTION_SCORING_STATUS = {
  SCORED: "SCORED",
} as const;

const FIFA_FLAG_EMOJI: Record<string, string> = {
  ARG: "🇦🇷",
  BRA: "🇧🇷",
  ENG: "🏴",
  ESP: "🇪🇸",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  POR: "🇵🇹",
  URU: "🇺🇾",
};

const SCORING_EXPLANATION_KIND = {
  CORRECT_OUTCOME: "correct-outcome",
  EXACT_SCORE: "exact-score",
  NOT_SCORED: "not-scored",
  WRONG_OUTCOME: "wrong-outcome",
} as const;

type ScoringExplanationKind = (typeof SCORING_EXPLANATION_KIND)[keyof typeof SCORING_EXPLANATION_KIND];

interface ScoreLine {
  homeScore: number;
  awayScore: number;
}

interface ScoringExplanation {
  kind: ScoringExplanationKind;
  title: string;
  detail: string;
}

function formatKickoff(kickoffAt: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(kickoffAt));
}

function formatStatusLabel(status: string): string {
  if (!status) {
    return "Unknown";
  }

  const normalized = status.split("_").join(" ").toLowerCase();

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatPredictionLabel(prediction: PredictionView | null): string {
  if (!prediction) {
    return "Pending";
  }

  return `${prediction.homeScore}–${prediction.awayScore}`;
}

function formatActualScoreLabel(match: MatchView): string {
  if (match.homeScore === null || match.awayScore === null) {
    return "Result pending";
  }

  return `${match.homeScore}–${match.awayScore}`;
}

function formatPointsLabel(points: number): string {
  return points === 1 ? "1 point" : `${points} points`;
}

function formatScoredAt(value: string | null): string {
  if (!value) {
    return "Not scored yet";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getFlagEmoji(flagCode: string | null): string | null {
  if (!flagCode) {
    return null;
  }

  const normalizedCode = flagCode.trim().toUpperCase();

  if (FIFA_FLAG_EMOJI[normalizedCode]) {
    return FIFA_FLAG_EMOJI[normalizedCode];
  }

  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return null;
  }

  return String.fromCodePoint(...Array.from(normalizedCode).map((char) => 127397 + char.charCodeAt(0)));
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

function formatOutcomeLabel(outcome: MatchOutcome): string {
  switch (outcome) {
    case MATCH_OUTCOME.HOME_WIN:
      return "home win";
    case MATCH_OUTCOME.AWAY_WIN:
      return "away win";
    case MATCH_OUTCOME.DRAW:
      return "draw";
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

function getScoringExplanation(match: MatchPredictionCard): ScoringExplanation | null {
  if (!match.prediction) {
    return null;
  }

  if (match.prediction.scoringStatus !== CLIENT_PREDICTION_SCORING_STATUS.SCORED) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: "Waiting for scoring",
      detail: "Your prediction exists, but this match has not been scored yet.",
    };
  }

  const actualScore = getActualScoreLine(match);

  if (!actualScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: "Final score unavailable",
      detail: "We have the match marked as final, but the score is not available yet.",
    };
  }

  const predictionScore = getPredictionScoreLine(match.prediction);
  const exactScore =
    predictionScore.homeScore === actualScore.homeScore && predictionScore.awayScore === actualScore.awayScore;

  if (exactScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.EXACT_SCORE,
      title: "Exact score",
      detail: `You nailed the final score: ${formatPointsLabel(match.prediction.pointsAwarded)} awarded.`,
    };
  }

  const predictedOutcome = resolveOutcome(predictionScore);
  const actualOutcome = resolveOutcome(actualScore);

  if (predictedOutcome === actualOutcome) {
    return {
      kind: SCORING_EXPLANATION_KIND.CORRECT_OUTCOME,
      title: "Correct outcome",
      detail: `You predicted a ${formatOutcomeLabel(predictedOutcome)}, and the match ended as a ${formatOutcomeLabel(actualOutcome)}.`,
    };
  }

  return {
    kind: SCORING_EXPLANATION_KIND.WRONG_OUTCOME,
    title: "Wrong outcome",
    detail: `You predicted a ${formatOutcomeLabel(predictedOutcome)}, but the match ended as a ${formatOutcomeLabel(actualOutcome)}.`,
  };
}

function getScoringExplanationClassName(kind: ScoringExplanationKind): string {
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

function isMatchOpenForPrediction(match: MatchView): boolean {
  return match.status === CLIENT_MATCH_STATUS.UPCOMING && Date.now() < new Date(match.kickoffAt).getTime();
}

function isMatchFinished(match: MatchView): boolean {
  return match.status === CLIENT_MATCH_STATUS.FINISHED || match.finalizedAt !== null;
}

function getPredictionOutcomeLabel(match: MatchPredictionCard): string {
  if (!isMatchFinished(match)) {
    return "Waiting for final result";
  }

  if (match.prediction === null) {
    return "No prediction submitted";
  }

  if (match.prediction.scoringStatus === CLIENT_PREDICTION_SCORING_STATUS.SCORED) {
    return `You earned ${formatPointsLabel(match.prediction.pointsAwarded)}`;
  }

  return "Prediction waiting to be scored";
}

function getInitialExpandedMatchId(matches: MatchPredictionCard[]): string | null {
  return matches.find((match) => match.prediction === null)?.id ?? null;
}

export function MatchPredictionAccordion({
  matches,
  profileComplete,
  submitPredictionAction,
}: MatchPredictionAccordionProps) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(() => getInitialExpandedMatchId(matches));

  if (matches.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
        No upcoming World Cup matches open for prediction right now. New scored matches will appear above when results land.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => {
        const matchFinished = isMatchFinished(match);
        const scoringExplanation = getScoringExplanation(match);
        const expanded = expandedMatchId === match.id;
        const homeFlag = getFlagEmoji(match.homeTeam.flagCode) ?? getFlagEmoji(match.homeTeam.countryCode);
        const awayFlag = getFlagEmoji(match.awayTeam.flagCode) ?? getFlagEmoji(match.awayTeam.countryCode);
        const predictionLabel = formatPredictionLabel(match.prediction);

        return (
          <article key={match.id} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/30">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedMatchId((current) => (current === match.id ? null : match.id))}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-3 p-4 text-left transition hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 sm:p-5"
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white sm:text-base">
                  <span aria-hidden="true">{homeFlag ?? "⚽"}</span>
                  <span>{match.homeTeam.shortName}</span>
                  <span className="text-slate-500">vs</span>
                  <span>{match.awayTeam.shortName}</span>
                  <span aria-hidden="true">{awayFlag ?? "⚽"}</span>
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {match.stage}{match.groupName ? ` · ${match.groupName}` : ""} · {formatKickoff(match.kickoffAt)}
                </span>
              </span>

              <span className="flex items-center gap-2">
                <span className="whitespace-nowrap rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 sm:px-3">
                  {predictionLabel}
                </span>
                <span aria-hidden="true" className="text-sm text-slate-500">
                  {expanded ? "−" : "+"}
                </span>
              </span>
            </button>

            {expanded ? (
              <div className="border-t border-slate-800 p-4 pt-5 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 font-semibold text-slate-300">
                    {formatStatusLabel(match.status)}
                  </span>
                  {matchFinished ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-300">
                      Final {formatActualScoreLabel(match)}
                    </span>
                  ) : null}
                </div>

                {matchFinished ? (
                  <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Final result</p>
                        <p className="mt-1 text-2xl font-black text-white">{formatActualScoreLabel(match)}</p>
                        <p className="mt-1 text-sm text-emerald-100/80">{getPredictionOutcomeLabel(match)}</p>
                      </div>

                      {match.prediction ? (
                        <div className="grid gap-3 sm:min-w-72 sm:grid-cols-2">
                          <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Your pick</p>
                            <p className="mt-1 text-lg font-bold text-white">{formatPredictionLabel(match.prediction)}</p>
                          </div>
                          <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-3">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Points earned</p>
                            <p className="mt-1 text-lg font-bold text-white">{formatPointsLabel(match.prediction.pointsAwarded)}</p>
                          </div>
                          <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-3 sm:col-span-2">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Scored at</p>
                            <p className="mt-1 text-sm font-semibold text-white">{formatScoredAt(match.prediction.scoredAt)}</p>
                          </div>
                          {scoringExplanation ? (
                            <div
                              className={`rounded-2xl border p-3 sm:col-span-2 ${getScoringExplanationClassName(scoringExplanation.kind)}`}
                            >
                              <p className="text-[11px] uppercase tracking-[0.2em] opacity-75">Why this score?</p>
                              <p className="mt-1 text-sm font-bold">{scoringExplanation.title}</p>
                              <p className="mt-1 text-xs leading-5 opacity-90">{scoringExplanation.detail}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300 sm:max-w-xs">
                          You did not submit a prediction for this match, so no points were awarded.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {profileComplete && isMatchOpenForPrediction(match) ? (
                  <form action={submitPredictionAction.bind(null, match.id)} className="mt-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Your prediction</p>
                        <p className="mt-1 text-sm text-cyan-100/75">Set the exact World Cup score.</p>
                      </div>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                        Exact score
                      </span>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                      <label className="group rounded-3xl border border-slate-800 bg-slate-950/70 p-3 text-center transition duration-200 focus-within:-translate-y-0.5 focus-within:border-cyan-300/60 focus-within:bg-slate-950 focus-within:shadow-lg focus-within:shadow-cyan-500/15 sm:p-4">
                        <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 group-focus-within:text-cyan-300">
                          {match.homeTeam.shortName}
                        </span>
                        <input
                          name="homeScore"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={20}
                          step={1}
                          defaultValue={match.prediction?.homeScore ?? ""}
                          className="score-input mt-2 w-full border-0 bg-transparent text-center text-4xl font-black tabular-nums text-cyan-200 outline-none ring-0 transition placeholder:text-slate-700 focus:outline-none focus:ring-0 focus-visible:outline-none sm:text-5xl"
                          placeholder="0"
                          required
                        />
                      </label>

                      <span className="pb-5 text-2xl font-black text-slate-600 sm:pb-6">–</span>

                      <label className="group rounded-3xl border border-slate-800 bg-slate-950/70 p-3 text-center transition duration-200 focus-within:-translate-y-0.5 focus-within:border-violet-300/60 focus-within:bg-slate-950 focus-within:shadow-lg focus-within:shadow-violet-500/15 sm:p-4">
                        <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 group-focus-within:text-violet-300">
                          {match.awayTeam.shortName}
                        </span>
                        <input
                          name="awayScore"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={20}
                          step={1}
                          defaultValue={match.prediction?.awayScore ?? ""}
                          className="score-input mt-2 w-full border-0 bg-transparent text-center text-4xl font-black tabular-nums text-violet-200 outline-none ring-0 transition placeholder:text-slate-700 focus:outline-none focus:ring-0 focus-visible:outline-none sm:text-5xl"
                          placeholder="0"
                          required
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="mt-4 w-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.01] hover:brightness-110 active:scale-[0.99]"
                    >
                      Save prediction
                    </button>
                  </form>
                ) : profileComplete ? (
                  <p className="mt-5 text-sm leading-6 text-slate-400">
                    {matchFinished
                      ? "This match is final, so predictions are locked."
                      : "This match is no longer open for predictions."}
                  </p>
                ) : (
                  <p className="mt-5 text-sm leading-6 text-slate-400">
                    Complete your profile to unlock the prediction form for this match.
                  </p>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
