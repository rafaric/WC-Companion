"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

const RECENTLY_SCORED_STATE_KEY = "worldpredict:dashboard:recently-scored:v2";

export interface RecentlyScoredResultItem {
  id: string;
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  stage: string | null;
  groupName: string | null;
  finalHomeScore: number;
  finalAwayScore: number;
  predictedHomeScore: number;
  predictedAwayScore: number;
  pointsAwarded: number;
  scoredAt: string;
  explanationKind: string;
  explanationTitle: string;
  explanationDetail: string;
}

export interface RecentlyScoredResultsStrings {
  locale: string;
  recentlyScored: string;
  newResultsFromYourPredictions: string;
  theseAreFinishedMatches: string;
  clear: string;
  final: string;
  yourPick: string;
  points: string;
  whyThisScore: string;
  stageUnavailable: string;
  pointUnit: string;
  pointsUnit: string;
}

interface RecentlyScoredResultsProps {
  items: RecentlyScoredResultItem[];
  i18n: RecentlyScoredResultsStrings;
}

interface RecentlyScoredState {
  fingerprint: string;
  lastSeenAt: string;
}

function buildFingerprint(items: RecentlyScoredResultItem[]): string {
  return items.map((item) => `${item.id}:${item.scoredAt}`).join("|");
}

function isRecentlyScoredState(value: unknown): value is RecentlyScoredState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.fingerprint === "string" &&
    typeof candidate.lastSeenAt === "string" &&
    candidate.fingerprint.length > 0 &&
    candidate.lastSeenAt.length > 0
  );
}

function readStoredState(fingerprint: string): RecentlyScoredState | null {
  const rawValue = window.localStorage.getItem(RECENTLY_SCORED_STATE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!isRecentlyScoredState(parsed) || parsed.fingerprint !== fingerprint) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getExplanationClassName(kind: string): string {
  switch (kind) {
    case "exact-score":
      return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
    case "correct-outcome":
      return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
    case "wrong-outcome":
      return "border-rose-300/30 bg-rose-300/10 text-rose-100";
    default:
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
}

function formatPointsLabel(points: number, i18n: RecentlyScoredResultsStrings): string {
  const unit = points === 1 ? i18n.pointUnit : i18n.pointsUnit;
  return `${points} ${unit}`;
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function RecentlyScoredResults({ items, i18n }: RecentlyScoredResultsProps) {
  const [state, setState] = useState<RecentlyScoredState | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const fingerprint = buildFingerprint(items);

  useEffect(() => {
    setState(readStoredState(fingerprint));
    setHasHydrated(true);
  }, [fingerprint]);

  const visibleItems =
    !hasHydrated || !state
      ? items
      : items.filter((item) => new Date(item.scoredAt).getTime() > new Date(state.lastSeenAt).getTime());

  function clearRecentlyScored() {
    const newestScoredAt = visibleItems[0]?.scoredAt ?? new Date().toISOString();
    const nextState = {
      fingerprint,
      lastSeenAt: newestScoredAt,
    } satisfies RecentlyScoredState;

    window.localStorage.setItem(RECENTLY_SCORED_STATE_KEY, JSON.stringify(nextState));
    setState(nextState);
  }

  if (!hasHydrated || visibleItems.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl shadow-emerald-950/20"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(16, 185, 129, 0.08), rgba(15, 23, 42, 0.9)), url(/assets/won.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">{i18n.recentlyScored}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{i18n.newResultsFromYourPredictions}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100/80">{i18n.theseAreFinishedMatches}</p>
        </div>
        <button
          type="button"
          onClick={clearRecentlyScored}
          className="rounded-full border border-emerald-300/30 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/60 hover:bg-slate-950/70"
        >
          {i18n.clear}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {visibleItems.map((item) => (
          <article key={item.id} className="rounded-2xl border border-emerald-300/20 bg-slate-950/50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <p className="font-semibold text-white">
                  {item.homeTeamName} vs {item.awayTeamName}
                </p>
                <p className="text-xs text-emerald-100/60">
                  {item.stage ?? i18n.stageUnavailable}
                  {item.groupName ? ` · ${item.groupName}` : ""} · {formatDateTime(item.scoredAt, i18n.locale)}
                </p>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[520px]">
                <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">{i18n.final}</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {item.finalHomeScore} - {item.finalAwayScore}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">{i18n.yourPick}</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {item.predictedHomeScore} - {item.predictedAwayScore}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">{i18n.points}</p>
                  <p className="mt-1 text-lg font-bold text-white">{formatPointsLabel(item.pointsAwarded, i18n)}</p>
                </div>
              </div>
            </div>

            <div className={cn("mt-4 rounded-2xl border p-3", getExplanationClassName(item.explanationKind))}>
              <p className="text-[11px] uppercase tracking-[0.2em] opacity-75">{i18n.whyThisScore}</p>
              <p className="mt-1 text-sm font-bold">{item.explanationTitle}</p>
              <p className="mt-1 text-xs leading-5 opacity-90">{item.explanationDetail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
