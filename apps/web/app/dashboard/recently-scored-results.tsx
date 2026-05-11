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

interface RecentlyScoredResultsProps {
  items: RecentlyScoredResultItem[];
}

interface RecentlyScoredState {
  fingerprint: string;
  lastSeenAt: string;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPointsLabel(points: number): string {
  return points === 1 ? "1 point" : `${points} points`;
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

export function RecentlyScoredResults({ items }: RecentlyScoredResultsProps) {
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
    <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-xl shadow-emerald-950/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Recently scored</p>
          <h2 className="mt-1 text-lg font-semibold text-white">New results from your predictions</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100/80">
            These are finished matches you predicted since you last cleared this section.
          </p>
        </div>
        <button
          type="button"
          onClick={clearRecentlyScored}
          className="rounded-full border border-emerald-300/30 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/60 hover:bg-slate-950/70"
        >
          Clear
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
                  {item.stage ?? "Stage unavailable"}
                  {item.groupName ? ` · ${item.groupName}` : ""} · scored {formatDateTime(item.scoredAt)}
                </p>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[520px]">
                <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Final</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {item.finalHomeScore} - {item.finalAwayScore}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Your pick</p>
                  <p className="mt-1 text-lg font-bold text-white">
                    {item.predictedHomeScore} - {item.predictedAwayScore}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Points</p>
                  <p className="mt-1 text-lg font-bold text-white">{formatPointsLabel(item.pointsAwarded)}</p>
                </div>
              </div>
            </div>

            <div className={cn("mt-4 rounded-2xl border p-3", getExplanationClassName(item.explanationKind))}>
              <p className="text-[11px] uppercase tracking-[0.2em] opacity-75">Why this score?</p>
              <p className="mt-1 text-sm font-bold">{item.explanationTitle}</p>
              <p className="mt-1 text-xs leading-5 opacity-90">{item.explanationDetail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
