import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import {
  ApiError,
  confirmExternalMatchResult,
  getPendingExternalMatchResults,
  importTournament,
  syncResults,
  type ExternalMatchResultView,
  type SportsDataSyncSummary,
} from "@/lib/api";

type AdminExternalResultsSearchParams = {
  error?: string;
  success?: string;
};

interface AdminExternalResultsPageProps {
  searchParams?: Promise<AdminExternalResultsSearchParams>;
}

type Session = NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>;

const RESULT_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You need the matches:finalize permission to review or confirm staged results.",
  already_processed: "This staged result was already confirmed or discarded.",
  bad_request: "We could not confirm that staged result.",
  invalid_input: "Missing staged result identifier.",
  not_found: "We could not find that staged result.",
  session_expired: "Your session expired or is missing the required admin permission.",
  unlinked_match: "This staged result is not linked to an internal match yet.",
};

const RESULT_SUCCESS_MESSAGES: Record<string, string> = {
  confirmed: "Staged result confirmed and the linked match was finalized.",
};

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
}: {
  result: ExternalMatchResultView;
  onConfirm: (formData: FormData) => Promise<void>;
}) {
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

      <div className="mt-5 flex items-center justify-end gap-3">
        <form action={onConfirm}>
          <input type="hidden" name="externalMatchResultId" value={result.id} />
          <button
            type="submit"
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
          >
            Confirm result
          </button>
        </form>
      </div>
    </article>
  );
}

export default async function AdminExternalResultsPage({ searchParams }: AdminExternalResultsPageProps) {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login?returnTo=/admin/external-results");
  }

  const resolvedSearchParams = await searchParams;

  let accessToken: string;

  try {
    accessToken = (await auth0.getAccessToken()).token;
  } catch {
    redirect("/auth/login?returnTo=/admin/external-results");
  }

  let stagedResults: ExternalMatchResultView[] = [];
  let loadErrorMessage: string | null = null;

  try {
    stagedResults = await getPendingExternalMatchResults(accessToken);
  } catch (error) {
    loadErrorMessage = getListLoadErrorMessage(error);
  }

  async function confirmExternalResult(formData: FormData) {
    "use server";

    const externalMatchResultId = String(formData.get("externalMatchResultId") ?? "").trim();

    if (!externalMatchResultId) {
      redirect("/admin/external-results?error=invalid_input");
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
      redirect(`/admin/external-results?error=${getResultErrorCode(error)}`);
    }

    revalidatePath("/admin/external-results");
    redirect("/admin/external-results?success=confirmed");
  }

  let syncResult: SportsDataSyncSummary | null = null;

  async function importTournamentAction() {
    "use server";

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/admin/external-results");
    }

    try {
      syncResult = await importTournament(actionToken);
    } catch (error) {
      // Silently fail - the UI will just not show a result
      console.error("Import tournament failed:", error);
    }

    revalidatePath("/admin/external-results");
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
      syncResult = await syncResults(actionToken);
    } catch (error) {
      // Silently fail
      console.error("Sync results failed:", error);
    }

    revalidatePath("/admin/external-results");
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
              Review provider-staged scores carefully before confirming them, because confirmation finalizes the linked
              internal match and updates the ranking tables.
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
            {syncResult ? (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-300">
                <p>
                  <span className="font-semibold text-cyan-300">Status:</span> {syncResult.status}
                </p>
                <p>
                  <span className="font-semibold text-cyan-300">Imported:</span> {syncResult.importedCount} |{" "}
                  <span className="font-semibold text-cyan-300">Updated:</span> {syncResult.updatedCount} |{" "}
                  <span className="font-semibold text-cyan-300">Staged:</span> {syncResult.stagedCount}
                </p>
              </div>
            ) : null}
          </div>

          {stagedResults.length > 0 ? (
            <div className="space-y-4">
              {stagedResults.map((result) => (
                <ResultCard key={result.id} result={result} onConfirm={confirmExternalResult} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-sm text-slate-300 shadow-xl shadow-slate-950/30">
              No pending staged results right now.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
