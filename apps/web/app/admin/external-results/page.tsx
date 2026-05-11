import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import {
  ApiError,
  confirmExternalMatchResult,
  discardExternalMatchResult,
  EXTERNAL_MATCH_RESULT_STATES,
  getExternalMatchResults,
  importTournament,
  syncResults,
  type ExternalMatchResultState,
  type ExternalMatchResultView,
} from "@/lib/api";

type AdminExternalResultsSearchParams = {
  error?: string;
  state?: string;
  success?: string;
};

interface AdminExternalResultsPageProps {
  searchParams?: Promise<AdminExternalResultsSearchParams>;
}

type Session = NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>;

const RESULT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You need the matches:finalize permission to review or confirm staged results.",
  already_processed: "This staged result was already confirmed or discarded.",
  bad_request: "We could not process that staged result.",
  invalid_input: "Missing staged result identifier.",
  not_found: "We could not find that staged result.",
  session_expired: "Your session expired or is missing the required admin permission.",
  unlinked_match: "This staged result is not linked to an internal match yet.",
};

const RESULT_SUCCESS_MESSAGES: Record<string, string> = {
  confirmed: "Staged result confirmed and the linked match was finalized.",
  discarded: "Staged result discarded without touching the linked match.",
  imported: "Mock tournament import completed.",
  synced: "Mock results sync completed.",
};

const EXTERNAL_MATCH_RESULT_FILTERS = [
  EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION,
  EXTERNAL_MATCH_RESULT_STATES.CONFIRMED,
  EXTERNAL_MATCH_RESULT_STATES.DISCARDED,
] as const;

function getDisplayName(user: Session["user"]): string {
  return user.name ?? user.nickname ?? user.email ?? user.sub;
}

function formatDateTime(value: string | Date | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStateLabel(state: string): string {
  return state.split("_").join(" ").toLowerCase();
}

function resolveResultStateFilter(value: string | undefined): ExternalMatchResultState {
  switch (value) {
    case EXTERNAL_MATCH_RESULT_STATES.CONFIRMED:
    case EXTERNAL_MATCH_RESULT_STATES.DISCARDED:
    case EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION:
      return value;
    default:
      return EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION;
  }
}

function buildExternalResultsPath(
  state: ExternalMatchResultState,
  params: { error?: string; success?: string } = {},
): string {
  const searchParams = new URLSearchParams({ state });

  if (params.error) {
    searchParams.set("error", params.error);
  }

  if (params.success) {
    searchParams.set("success", params.success);
  }

  return `/admin/external-results?${searchParams.toString()}`;
}

function getResultErrorCode(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "bad_request";
  }

  if (error.status === 401 || error.status === 403) {
    return "access_denied";
  }

  if (error.status === 404) {
    return "not_found";
  }

  if (error.status === 409) {
    return "already_processed";
  }

  if (error.status === 400) {
    const responseBody = error.responseBody.toLowerCase();

    if (responseBody.includes("not linked to an internal match")) {
      return "unlinked_match";
    }

    return "bad_request";
  }

  return "bad_request";
}

function getListLoadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "We could not load staged results right now.";
  }

  if (error.status === 401 || error.status === 403) {
    return RESULT_ERROR_MESSAGES.access_denied;
  }

  return "We could not load staged results right now.";
}

function ResultCard({
  result,
  onConfirm,
  onDiscard,
  currentState,
}: {
  result: ExternalMatchResultView;
  onConfirm: (formData: FormData) => Promise<void>;
  onDiscard: (formData: FormData) => Promise<void>;
  currentState: ExternalMatchResultState;
}) {
  const isPending = result.state === EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION;

  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Provider</p>
            <p className="mt-1 text-sm font-semibold text-white">{result.providerKey}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">External match ID</p>
            <p className="mt-1 text-sm font-semibold text-white">{result.externalMatchId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Internal match</p>
            {result.match ? (
              <div className="mt-1 space-y-1 text-sm text-slate-200">
                <p className="font-semibold text-white">{result.match.homeTeamName} vs {result.match.awayTeamName}</p>
                <p>{result.match.stage ?? "Stage unavailable"}{result.match.groupName ? ` • ${result.match.groupName}` : ""}</p>
                <p>
                  {result.match.matchId} • {result.match.status} • {formatDateTime(result.match.kickoffAt)}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-amber-200">Not linked yet — confirm only after the internal match exists.</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:grid-cols-2 lg:min-w-72">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Proposed score</p>
            <p className="mt-1 text-2xl font-black text-white">
              {result.homeScore} - {result.awayScore}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">State</p>
            <p className="mt-1 text-sm font-semibold text-emerald-300">{formatStateLabel(result.state)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Played at</p>
            <p className="mt-1 text-sm text-slate-200">{formatDateTime(result.playedAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Staged at</p>
            <p className="mt-1 text-sm text-slate-200">{formatDateTime(result.stagedAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Confirmed at</p>
            <p className="mt-1 text-sm text-slate-200">{formatDateTime(result.confirmedAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Discarded at</p>
            <p className="mt-1 text-sm text-slate-200">{formatDateTime(result.discardedAt)}</p>
          </div>
        </div>
      </div>

      {isPending ? (
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <form action={onDiscard}>
            <input type="hidden" name="externalMatchResultId" value={result.id} />
            <input type="hidden" name="state" value={currentState} />
            <button
              type="submit"
              className="rounded-full border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-300/60 hover:bg-rose-400/20"
            >
              Discard result
            </button>
          </form>
          <form action={onConfirm}>
            <input type="hidden" name="externalMatchResultId" value={result.id} />
            <input type="hidden" name="state" value={currentState} />
            <button
              type="submit"
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            >
              Confirm result
            </button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export default async function AdminExternalResultsPage({ searchParams }: AdminExternalResultsPageProps) {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login?returnTo=/admin/external-results");
  }

  const resolvedSearchParams = await searchParams;
  const currentState = resolveResultStateFilter(resolvedSearchParams?.state);

  let accessToken: string;

  try {
    accessToken = (await auth0.getAccessToken()).token;
  } catch {
    redirect("/auth/login?returnTo=/admin/external-results");
  }

  let stagedResults: ExternalMatchResultView[] = [];
  let loadErrorMessage: string | null = null;

  try {
    stagedResults = await getExternalMatchResults(accessToken, currentState);
  } catch (error) {
    loadErrorMessage = getListLoadErrorMessage(error);
  }

  async function confirmExternalResult(formData: FormData) {
    "use server";

    const externalMatchResultId = String(formData.get("externalMatchResultId") ?? "").trim();
    const state = resolveResultStateFilter(String(formData.get("state") ?? ""));

    if (!externalMatchResultId) {
      redirect(buildExternalResultsPath(state, { error: "invalid_input" }));
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/admin/external-results");
    }

    try {
      await confirmExternalMatchResult(actionToken, externalMatchResultId);
    } catch (error) {
      redirect(buildExternalResultsPath(state, { error: getResultErrorCode(error) }));
    }

    revalidatePath("/admin/external-results");
    redirect(buildExternalResultsPath(state, { success: "confirmed" }));
  }

  async function discardExternalResult(formData: FormData) {
    "use server";

    const externalMatchResultId = String(formData.get("externalMatchResultId") ?? "").trim();
    const state = resolveResultStateFilter(String(formData.get("state") ?? ""));

    if (!externalMatchResultId) {
      redirect(buildExternalResultsPath(state, { error: "invalid_input" }));
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/admin/external-results");
    }

    try {
      await discardExternalMatchResult(actionToken, externalMatchResultId);
    } catch (error) {
      redirect(buildExternalResultsPath(state, { error: getResultErrorCode(error) }));
    }

    revalidatePath("/admin/external-results");
    redirect(buildExternalResultsPath(state, { success: "discarded" }));
  }

  async function importTournamentAction() {
    "use server";

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/admin/external-results");
    }

    try {
      await importTournament(actionToken);
    } catch (error) {
      console.error("Import tournament failed:", error);
      redirect(buildExternalResultsPath(EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION, { error: "bad_request" }));
    }

    revalidatePath("/admin/external-results");
    redirect(buildExternalResultsPath(EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION, { success: "imported" }));
  }

  async function syncResultsAction() {
    "use server";

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/admin/external-results");
    }

    try {
      await syncResults(actionToken);
    } catch (error) {
      console.error("Sync results failed:", error);
      redirect(buildExternalResultsPath(EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION, { error: "bad_request" }));
    }

    revalidatePath("/admin/external-results");
    redirect(buildExternalResultsPath(EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION, { success: "synced" }));
  }

  const displayName = getDisplayName(session.user);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="worldpredict-aurora absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 rounded-full border border-slate-800/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">WorldPredict</p>
            <p className="text-xs text-slate-400">Admin external results</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="hidden sm:inline">{displayName}</span>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
            >
              Dashboard
            </Link>
            <Link
              href="/auth/logout"
              className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
            >
              Log out
            </Link>
          </div>
        </header>

        <section className="space-y-6 py-8 sm:py-10">
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
              Admin-only review queue
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Confirm staged external results.</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              This screen requires the <span className="font-semibold text-amber-200">matches:finalize</span> permission.
              Review provider-staged scores carefully before confirming or discarding them, because confirmation finalizes
              the linked internal match and updates the ranking tables.
            </p>
          </div>

          {resolvedSearchParams?.error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {RESULT_ERROR_MESSAGES[resolvedSearchParams.error] ?? RESULT_ERROR_MESSAGES.bad_request}
            </div>
          ) : null}

          {resolvedSearchParams?.success ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {RESULT_SUCCESS_MESSAGES[resolvedSearchParams.success] ?? RESULT_SUCCESS_MESSAGES.confirmed}
            </div>
          ) : null}

          {loadErrorMessage ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {loadErrorMessage}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <p className="mb-4 text-sm font-medium text-slate-300">Admin sync actions (mock provider)</p>
            <div className="flex flex-wrap gap-3">
              <form action={importTournamentAction} className="inline">
                <button
                  type="submit"
                  className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                >
                  Import tournament
                </button>
              </form>
              <form action={syncResultsAction} className="inline">
                <button
                  type="submit"
                  className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                >
                  Sync results
                </button>
              </form>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXTERNAL_MATCH_RESULT_FILTERS.map((state) => {
              const isActive = state === currentState;

              return (
                <Link
                  key={state}
                  href={buildExternalResultsPath(state)}
                  className={
                    isActive
                      ? "rounded-full border border-cyan-300/50 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-100"
                      : "rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                  }
                >
                  {formatStateLabel(state)}
                </Link>
              );
            })}
          </div>

          {stagedResults.length > 0 ? (
            <div className="space-y-4">
              {stagedResults.map((result) => (
                <ResultCard
                  key={result.id}
                  currentState={currentState}
                  result={result}
                  onConfirm={confirmExternalResult}
                  onDiscard={discardExternalResult}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-sm text-slate-300 shadow-xl shadow-slate-950/30">
              No {formatStateLabel(currentState)} staged results right now.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
