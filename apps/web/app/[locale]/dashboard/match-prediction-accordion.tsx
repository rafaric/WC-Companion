"use client";

import { useState, useEffect } from "react";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import type { MatchView, PredictionView } from "@/lib/api";
import { FlagIcon } from "@/components/FlagIcon";

interface MatchPredictionCard extends MatchView {
  prediction: PredictionView | null;
}

export interface DashboardStrings {
  noUpcomingMatches: string;
  loadingLocalDates: string;
  previousDate: string;
  nextDate: string;
  vs: string;
  exactScore: string;
  finalResult: string;
  yourPick: string;
  pointsEarned: string;
  scoredAt: string;
  whyThisScore: string;
  noPredictionSubmitted: string;
  yourPrediction: string;
  setExactWorldCupScore: string;
  savePrediction: string;
  matchFinalLocked: string;
  matchNoLongerOpen: string;
  completeProfileToUnlock: string;
  pending: string;
  resultPending: string;
  unknown: string;
  waitingForFinalResult: string;
  noPredictionSubmittedLabel: string;
  predictionWaitingToBeScored: string;
  youEarned: string;
  formatPointsLabel: (points: number) => string;
  formatStatusLabel: (status: string) => string;
  formatOutcomeLabel: (outcome: "home-win" | "away-win" | "draw") => string;
  formatScoredAt: (value: string | null) => string;
  waitingForScoring: string;
  waitingForScoringDetail: string;
  finalScoreUnavailable: string;
  finalScoreUnavailableDetail: string;
  correctOutcome: string;
  wrongOutcome: string;
}

interface MatchPredictionAccordionProps {
  matches: MatchPredictionCard[];
  profileComplete: boolean;
  submitPredictionAction: (matchId: string, formData: FormData) => Promise<void>;
  i18n: DashboardStrings;
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

function resolveOutcome(score: ScoreLine): MatchOutcome {
  if (score.homeScore > score.awayScore) {
    return MATCH_OUTCOME.HOME_WIN;
  }

  if (score.homeScore < score.awayScore) {
    return MATCH_OUTCOME.AWAY_WIN;
  }

  return MATCH_OUTCOME.DRAW;
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

function getScoringExplanation(match: MatchPredictionCard, i18n: DashboardStrings): ScoringExplanation | null {
  if (!match.prediction) {
    return null;
  }

  if (match.prediction.scoringStatus !== CLIENT_PREDICTION_SCORING_STATUS.SCORED) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: i18n.waitingForScoring,
      detail: i18n.waitingForScoringDetail,
    };
  }

  const actualScore = getActualScoreLine(match);

  if (!actualScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.NOT_SCORED,
      title: i18n.finalScoreUnavailable,
      detail: i18n.finalScoreUnavailableDetail,
    };
  }

  const predictionScore = getPredictionScoreLine(match.prediction);
  const exactScore =
    predictionScore.homeScore === actualScore.homeScore && predictionScore.awayScore === actualScore.awayScore;

  if (exactScore) {
    return {
      kind: SCORING_EXPLANATION_KIND.EXACT_SCORE,
      title: i18n.exactScore,
      detail: `You nailed the final score: ${i18n.formatPointsLabel(match.prediction.pointsAwarded)} awarded.`,
    };
  }

  const predictedOutcome = resolveOutcome(predictionScore);
  const actualOutcome = resolveOutcome(actualScore);

  if (predictedOutcome === actualOutcome) {
    return {
      kind: SCORING_EXPLANATION_KIND.CORRECT_OUTCOME,
      title: i18n.correctOutcome,
      detail: `You predicted a ${i18n.formatOutcomeLabel(predictedOutcome)}, and the match ended as a ${i18n.formatOutcomeLabel(actualOutcome)}.`,
    };
  }

  return {
    kind: SCORING_EXPLANATION_KIND.WRONG_OUTCOME,
    title: i18n.wrongOutcome,
    detail: `You predicted a ${i18n.formatOutcomeLabel(predictedOutcome)}, but the match ended as ${i18n.formatOutcomeLabel(actualOutcome)}.`,
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

function getPredictionOutcomeLabel(match: MatchPredictionCard, i18n: DashboardStrings): string {
  if (!isMatchFinished(match)) {
    return i18n.waitingForFinalResult;
  }

  if (match.prediction === null) {
    return i18n.noPredictionSubmittedLabel;
  }

  if (match.prediction.scoringStatus === CLIENT_PREDICTION_SCORING_STATUS.SCORED) {
    return i18n.youEarned.replace("{points}", i18n.formatPointsLabel(match.prediction.pointsAwarded));
  }

  return i18n.predictionWaitingToBeScored;
}

function getInitialExpandedMatchId(matches: MatchPredictionCard[]): string | null {
  return matches.find((match) => match.prediction === null)?.id ?? null;
}

interface MatchGroup {
  date: Date;
  dateLabel: string;
  matches: MatchPredictionCard[];
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupMatchesByDate(matches: MatchPredictionCard[]): MatchGroup[] {
  const groups: Map<string, MatchGroup> = new Map();

  for (const match of matches) {
    const matchDate = new Date(match.kickoffAt);
    const dateKey = getLocalDateKey(matchDate);

    let group = groups.get(dateKey);

    if (!group) {
      const dateLabel = new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(matchDate);

      group = { date: matchDate, dateLabel, matches: [] };
      groups.set(dateKey, group);
    }

    group.matches.push(match);
  }

  return Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function MatchPredictionAccordion({
  matches,
  profileComplete,
  submitPredictionAction,
  i18n,
}: MatchPredictionAccordionProps) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(() => getInitialExpandedMatchId(matches));
  const [hasHydrated, setHasHydrated] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [animationDirection, setAnimationDirection] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const matchGroups = hasHydrated ? groupMatchesByDate(matches) : [];

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (currentGroupIndex >= matchGroups.length) {
      setCurrentGroupIndex(Math.max(0, matchGroups.length - 1));
    }
  }, [hasHydrated, matchGroups.length, currentGroupIndex]);

  if (matches.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
        {i18n.noUpcomingMatches}
      </div>
    );
  }

  if (!hasHydrated) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
        {i18n.loadingLocalDates}
      </div>
    );
  }

  const safeCurrentGroupIndex = Math.min(currentGroupIndex, matchGroups.length - 1);
  const currentGroup = matchGroups[safeCurrentGroupIndex];
  const hasMultipleGroups = matchGroups.length > 1;
  const canGoPrevious = safeCurrentGroupIndex > 0;
  const canGoNext = safeCurrentGroupIndex < matchGroups.length - 1;

  const handlePrevious = () => {
    if (canGoPrevious) {
      setAnimationDirection(-1);
      setCurrentGroupIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      setAnimationDirection(1);
      setCurrentGroupIndex((prev) => prev + 1);
    }
  };

  const slideVariants = shouldReduceMotion
    ? {
        enter: { opacity: 1, x: 0 },
        center: { opacity: 1, x: 0 },
        exit: { opacity: 1, x: 0 },
      }
    : {
        enter: (dir: number) => ({
          opacity: 0,
          x: dir === 0 ? 0 : dir > 0 ? 50 : -50,
        }),
        center: {
          opacity: 1,
          x: 0,
        },
        exit: (dir: number) => ({
          opacity: 0,
          x: dir === 0 ? 0 : dir < 0 ? 50 : -50,
        }),
      };

  return (
    <div className="space-y-6">
      {hasMultipleGroups && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={!canGoPrevious}
            aria-label={i18n.previousDate}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
              canGoPrevious
                ? "border-slate-700 bg-slate-800 text-slate-300 hover:border-cyan-400/50 hover:bg-slate-700 hover:text-cyan-300"
                : "cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-600"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="size-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {safeCurrentGroupIndex + 1} of {matchGroups.length}
            </span>
            <span className="mt-1 text-base font-semibold text-white">{currentGroup.dateLabel}</span>
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext}
            aria-label={i18n.nextDate}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
              canGoNext
                ? "border-slate-700 bg-slate-800 text-slate-300 hover:border-cyan-400/50 hover:bg-slate-700 hover:text-cyan-300"
                : "cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-600"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="size-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}

      <AnimatePresence mode="wait" custom={animationDirection}>
        <motion.div
          key={safeCurrentGroupIndex}
          custom={animationDirection}
          variants={slideVariants}
          initial={shouldReduceMotion ? "center" : "enter"}
          animate="center"
          exit={shouldReduceMotion ? "center" : "exit"}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
        >
          <section className="space-y-3">
            {!hasMultipleGroups && (
              <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
                {currentGroup.dateLabel}
              </h2>
            )}
            {currentGroup.matches.map((match) => {
              const matchFinished = isMatchFinished(match);
              const scoringExplanation = getScoringExplanation(match, i18n);
              const expanded = expandedMatchId === match.id;
              const predictionLabel = match.prediction
                ? `${match.prediction.homeScore}–${match.prediction.awayScore}`
                : i18n.pending;

              return (
                <article
                  key={match.id}
                  className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-slate-950/30"
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedMatchId((current) => (current === match.id ? null : match.id))}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-3 p-4 text-left transition hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 sm:p-5"
                  >
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white sm:text-base">
                        <FlagIcon flagCode={match.homeTeam.flagCode} countryCode={match.homeTeam.countryCode} />
                        <span>{match.homeTeam.shortName}</span>
                        <span className="text-slate-500">{i18n.vs}</span>
                        <span>{match.awayTeam.shortName}</span>
                        <FlagIcon flagCode={match.awayTeam.flagCode} countryCode={match.awayTeam.countryCode} />
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {match.stage}
                        {match.groupName ? ` · ${match.groupName}` : ""} · {formatKickoff(match.kickoffAt)}
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
                          {i18n.formatStatusLabel(match.status)}
                        </span>
                        {matchFinished ? (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-300">
                            {i18n.finalResult}{" "}
                            {match.homeScore !== null && match.awayScore !== null
                              ? `${match.homeScore}–${match.awayScore}`
                              : i18n.resultPending}
                          </span>
                        ) : null}
                      </div>

                      {matchFinished ? (
                        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">{i18n.finalResult}</p>
                              <p className="mt-1 text-2xl font-black text-white">
                                {match.homeScore !== null && match.awayScore !== null
                                  ? `${match.homeScore}–${match.awayScore}`
                                  : i18n.resultPending}
                              </p>
                              <p className="mt-1 text-sm text-emerald-100/80">
                                {getPredictionOutcomeLabel(match, i18n)}
                              </p>
                            </div>

                            {match.prediction ? (
                              <div className="grid gap-3 sm:min-w-72 sm:grid-cols-2">
                                <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">{i18n.yourPick}</p>
                                  <p className="mt-1 text-lg font-bold text-white">
                                    {match.prediction.homeScore}–{match.prediction.awayScore}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-3">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">{i18n.pointsEarned}</p>
                                  <p className="mt-1 text-lg font-bold text-white">
                                    {i18n.formatPointsLabel(match.prediction.pointsAwarded)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-3 sm:col-span-2">
                                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">{i18n.scoredAt}</p>
                                  <p className="mt-1 text-sm font-semibold text-white">
                                    {i18n.formatScoredAt(match.prediction.scoredAt)}
                                  </p>
                                </div>
                                {scoringExplanation ? (
                                  <div
                                    className={`rounded-2xl border p-3 sm:col-span-2 ${getScoringExplanationClassName(scoringExplanation.kind)}`}
                                  >
                                    <p className="text-[11px] uppercase tracking-[0.2em] opacity-75">{i18n.whyThisScore}</p>
                                    <p className="mt-1 text-sm font-bold">{scoringExplanation.title}</p>
                                    <p className="mt-1 text-xs leading-5 opacity-90">{scoringExplanation.detail}</p>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300 sm:max-w-xs">
                                {i18n.noPredictionSubmitted}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {profileComplete && isMatchOpenForPrediction(match) ? (
                        <form action={submitPredictionAction.bind(null, match.id)} className="mt-5">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{i18n.yourPrediction}</p>
                              <p className="mt-1 text-sm text-cyan-100/75">{i18n.setExactWorldCupScore}</p>
                            </div>
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                              {i18n.exactScore}
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
                            {i18n.savePrediction}
                          </button>
                        </form>
                      ) : profileComplete ? (
                        <p className="mt-5 text-sm leading-6 text-slate-400">
                          {matchFinished ? i18n.matchFinalLocked : i18n.matchNoLongerOpen}
                        </p>
                      ) : (
                        <p className="mt-5 text-sm leading-6 text-slate-400">{i18n.completeProfileToUnlock}</p>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}