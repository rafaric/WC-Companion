import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth0 } from "@/lib/auth0";
import {
  ApiError,
  confirmExternalMatchResult,
  discardExternalMatchResult,
  EXTERNAL_MATCH_RESULT_STATES,
  getActiveTournament,
  getExternalMatchMappingDiagnostics,
  getExternalMatchResults,
  getExternalSyncRuns,
  importTournament,
  syncResults,
  type ExternalMatchMappingDiagnosticView,
  type ExternalMatchResultState,
  type ExternalMatchResultView,
  type ExternalSyncRunView,
} from "@/lib/api";
import { buildPageMetadata } from "@/lib/metadata";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import { getLocalizedPath, type AppLocale } from "@/lib/locale-nav";

type AdminExternalResultsTranslator = Awaited<ReturnType<typeof getTranslations>>;

type AdminExternalResultsSearchParams = {
  error?: string;
  state?: string;
  success?: string;
};

interface AdminExternalResultsPageProps {
  searchParams?: Promise<AdminExternalResultsSearchParams>;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AdminExternalResultsPageProps) {
  const { locale } = await params;
  const t = await getTranslations("admin.externalResults");
  return buildPageMetadata({
    title: t("metadata.title"),
    description: t("metadata.description"),
    index: false,
    locale,
    path: "/admin/external-results",
  });
}

const EXTERNAL_MATCH_RESULT_FILTERS = [
  EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION,
  EXTERNAL_MATCH_RESULT_STATES.CONFIRMED,
  EXTERNAL_MATCH_RESULT_STATES.DISCARDED,
] as const;

function formatDateTime(value: string | Date | null, locale: string): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStateLabel(state: string, t: AdminExternalResultsTranslator): string {
  switch (state) {
    case EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION:
      return t("stateLabels.pendingConfirmation");
    case EXTERNAL_MATCH_RESULT_STATES.CONFIRMED:
      return t("stateLabels.confirmed");
    case EXTERNAL_MATCH_RESULT_STATES.DISCARDED:
      return t("stateLabels.discarded");
    default:
      return state.split("_").join(" ").toLowerCase();
  }
}

function formatSyncTypeLabel(syncType: string, t: AdminExternalResultsTranslator): string {
  switch (syncType) {
    case "IMPORT":
      return t("syncTypeLabels.import");
    case "RESULTS":
      return t("syncTypeLabels.results");
    default:
      return syncType.toLowerCase();
  }
}

function formatSyncStatusLabel(status: string, t: AdminExternalResultsTranslator): string {
  switch (status) {
    case "SUCCESS":
      return t("syncStatusLabels.success");
    case "FAILED":
      return t("syncStatusLabels.failed");
    case "RUNNING":
      return t("syncStatusLabels.running");
    default:
      return status.toLowerCase();
  }
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
  locale: AppLocale,
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

  return `${getLocalizedPath(locale, "/admin/external-results")}?${searchParams.toString()}`;
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

function getListLoadErrorMessage(error: unknown, t: AdminExternalResultsTranslator): string {
  if (!(error instanceof ApiError)) {
    return t("errors.listLoadFailed");
  }
  if (error.status === 401 || error.status === 403) {
    return t("errors.accessDenied");
  }
  return t("errors.listLoadFailed");
}

function getDiagnosticStatusLabel(diagnostic: ExternalMatchMappingDiagnosticView, t: AdminExternalResultsTranslator): string {
  if (!diagnostic.hasExternalReference) {
    return t("diagnosticCard.missing");
  }
  if (!diagnostic.latestExternalResult) {
    return t("diagnosticCard.noExternalResultYet");
  }
  return formatStateLabel(diagnostic.latestExternalResult.state, t);
}

function getDiagnosticStatusClassName(diagnostic: ExternalMatchMappingDiagnosticView): string {
  if (!diagnostic.hasExternalReference) {
    return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  }

  if (!diagnostic.latestExternalResult) {
    return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  }

  if (diagnostic.latestExternalResult.state === EXTERNAL_MATCH_RESULT_STATES.CONFIRMED) {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  }

  if (diagnostic.latestExternalResult.state === EXTERNAL_MATCH_RESULT_STATES.DISCARDED) {
    return "border-slate-600 bg-slate-800/60 text-slate-200";
  }

  return "border-cyan-400/30 bg-cyan-400/10 text-cyan-100";
}

function getSyncRunStatusClassName(status: string): string {
  switch (status) {
    case "SUCCESS":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
    case "FAILED":
      return "border-rose-400/30 bg-rose-400/10 text-rose-100";
    case "RUNNING":
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-100";
    default:
      return "border-slate-700 bg-slate-800/60 text-slate-200";
  }
}

function getLatestSyncRunByType(syncRuns: ExternalSyncRunView[], syncType: string): ExternalSyncRunView | null {
  return syncRuns.find((syncRun) => syncRun.syncType === syncType) ?? null;
}

function getSearchErrorMessage(code: string | undefined, t: AdminExternalResultsTranslator): string {
  switch (code) {
    case "access_denied":
      return t("errors.accessDenied");
    case "already_processed":
      return t("errors.alreadyProcessed");
    case "bad_request":
      return t("errors.badRequest");
    case "invalid_input":
      return t("errors.invalidInput");
    case "not_found":
      return t("errors.notFound");
    case "session_expired":
      return t("errors.sessionExpired");
    case "unlinked_match":
      return t("errors.unlinkedMatch");
    default:
      return t("errors.badRequest");
  }
}

function getSearchSuccessMessage(code: string | undefined, t: AdminExternalResultsTranslator): string {
  switch (code) {
    case "confirmed":
      return t("success.confirmed");
    case "discarded":
      return t("success.discarded");
    case "imported":
      return t("success.imported");
    case "synced":
      return t("success.synced");
    default:
      return t("success.confirmed");
  }
}

function ResultCard({
  result,
  onConfirm,
  onDiscard,
  currentState,
  t,
  locale,
}: {
  result: ExternalMatchResultView;
  onConfirm: (formData: FormData) => Promise<void>;
  onDiscard: (formData: FormData) => Promise<void>;
  currentState: ExternalMatchResultState;
  t: AdminExternalResultsTranslator;
  locale: string;
}) {
  const isPending = result.state === EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION;

  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("resultCard.provider")}</p>
            <p className="mt-1 text-sm font-semibold text-white">{result.providerKey}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("resultCard.externalMatchId")}</p>
            <p className="mt-1 text-sm font-semibold text-white">{result.externalMatchId}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("resultCard.internalMatch")}</p>
            {result.match ? (
              <div className="mt-1 space-y-1 text-sm text-slate-200">
                <p className="font-semibold text-white">{t("matchup", { homeTeam: result.match.homeTeamName, awayTeam: result.match.awayTeamName })}</p>
                <p>{result.match.stage ?? t("resultCard.stageUnavailable")}{result.match.groupName ? ` • ${result.match.groupName}` : ""}</p>
                <p>
                  {result.match.matchId} • {result.match.status} • {formatDateTime(result.match.kickoffAt, locale)}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-amber-200">{t("resultCard.notLinked")}</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:grid-cols-2 lg:min-w-72">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("resultCard.proposedScore")}</p>
            <p className="mt-1 text-2xl font-black text-white">
              {result.homeScore} - {result.awayScore}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("resultCard.state")}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-300">{formatStateLabel(result.state, t)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("resultCard.playedAt")}</p>
            <p className="mt-1 text-sm text-slate-200">{formatDateTime(result.playedAt, locale)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("resultCard.stagedAt")}</p>
            <p className="mt-1 text-sm text-slate-200">{formatDateTime(result.stagedAt, locale)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("resultCard.confirmedAt")}</p>
            <p className="mt-1 text-sm text-slate-200">{formatDateTime(result.confirmedAt, locale)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("resultCard.discardedAt")}</p>
            <p className="mt-1 text-sm text-slate-200">{formatDateTime(result.discardedAt, locale)}</p>
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
              {t("resultCard.discardResult")}
            </button>
          </form>
          <form action={onConfirm}>
            <input type="hidden" name="externalMatchResultId" value={result.id} />
            <input type="hidden" name="state" value={currentState} />
            <button
              type="submit"
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            >
              {t("resultCard.confirmResult")}
            </button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export default async function AdminExternalResultsPage({ searchParams, params }: AdminExternalResultsPageProps) {
  const { locale } = await params;
  const t = await getTranslations("admin.externalResults");
  const session = await auth0.getSession();

  if (!session) {
    redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/admin/external-results")}`);
  }

  const resolvedSearchParams = await searchParams;
  const currentState = resolveResultStateFilter(resolvedSearchParams?.state);

  let accessToken: string;

  try {
    accessToken = (await auth0.getAccessToken()).token;
  } catch {
    redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/admin/external-results")}`);
  }

  const tournamentSlug = await resolveTournamentSlug();

  let stagedResults: ExternalMatchResultView[] = [];
  let matchDiagnostics: ExternalMatchMappingDiagnosticView[] = [];
  let syncRuns: ExternalSyncRunView[] = [];
  let loadErrorMessage: string | null = null;
  let diagnosticsLoadErrorMessage: string | null = null;
  let syncRunsLoadErrorMessage: string | null = null;

  try {
    stagedResults = await getExternalMatchResults(accessToken, currentState, tournamentSlug);
  } catch (error) {
    loadErrorMessage = getListLoadErrorMessage(error, t);
  }

  try {
    matchDiagnostics = await getExternalMatchMappingDiagnostics(accessToken, tournamentSlug);
  } catch (error) {
    diagnosticsLoadErrorMessage = getListLoadErrorMessage(error, t);
  }

  try {
    syncRuns = await getExternalSyncRuns(accessToken, tournamentSlug);
  } catch (error) {
    syncRunsLoadErrorMessage = getListLoadErrorMessage(error, t);
  }

  async function confirmExternalResult(formData: FormData) {
    "use server";

    const externalMatchResultId = String(formData.get("externalMatchResultId") ?? "").trim();
    const state = resolveResultStateFilter(String(formData.get("state") ?? ""));

    if (!externalMatchResultId) {
      redirect(buildExternalResultsPath(locale as AppLocale, state, { error: "invalid_input" }));
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/admin/external-results")}`);
    }

    try {
      await confirmExternalMatchResult(actionToken, externalMatchResultId);
    } catch (error) {
      redirect(buildExternalResultsPath(locale as AppLocale, state, { error: getResultErrorCode(error) }));
    }

    revalidatePath(getLocalizedPath(locale as AppLocale, "/admin/external-results"));
    redirect(buildExternalResultsPath(locale as AppLocale, state, { success: "confirmed" }));
  }

  async function discardExternalResult(formData: FormData) {
    "use server";

    const externalMatchResultId = String(formData.get("externalMatchResultId") ?? "").trim();
    const state = resolveResultStateFilter(String(formData.get("state") ?? ""));

    if (!externalMatchResultId) {
      redirect(buildExternalResultsPath(locale as AppLocale, state, { error: "invalid_input" }));
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/admin/external-results")}`);
    }

    try {
      await discardExternalMatchResult(actionToken, externalMatchResultId);
    } catch (error) {
      redirect(buildExternalResultsPath(locale as AppLocale, state, { error: getResultErrorCode(error) }));
    }

    revalidatePath(getLocalizedPath(locale as AppLocale, "/admin/external-results"));
    redirect(buildExternalResultsPath(locale as AppLocale, state, { success: "discarded" }));
  }

  async function importTournamentAction() {
    "use server";

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/admin/external-results")}`);
    }

    // Get tournament ID from slug for admin write operations (backend requires tournamentId, not slug)
    const tournamentSlug = await resolveTournamentSlug();
    let tournamentId: string | undefined = undefined;

    if (tournamentSlug) {
      try {
        const tournament = await getActiveTournament(tournamentSlug);
        tournamentId = tournament.id;
      } catch {
        // Tournament not found, proceed without ID
      }
    }

    try {
      await importTournament(actionToken, tournamentId);
    } catch (error) {
      console.error("Import tournament failed:", error);
      redirect(buildExternalResultsPath(locale as AppLocale, EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION, { error: "bad_request" }));
    }

    revalidatePath(getLocalizedPath(locale as AppLocale, "/admin/external-results"));
    redirect(buildExternalResultsPath(locale as AppLocale, EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION, { success: "imported" }));
  }

  async function syncResultsAction() {
    "use server";

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect(`/auth/login?returnTo=${getLocalizedPath(locale as AppLocale, "/admin/external-results")}`);
    }

    // Get tournament ID from slug for admin write operations (backend requires tournamentId, not slug)
    const tournamentSlug = await resolveTournamentSlug();
    let tournamentId: string | undefined = undefined;

    if (tournamentSlug) {
      try {
        const tournament = await getActiveTournament(tournamentSlug);
        tournamentId = tournament.id;
      } catch {
        // Tournament not found, proceed without ID
      }
    }

    try {
      await syncResults(actionToken, tournamentId);
    } catch (error) {
      console.error("Sync results failed:", error);
      redirect(buildExternalResultsPath(locale as AppLocale, EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION, { error: "bad_request" }));
    }

    revalidatePath(getLocalizedPath(locale as AppLocale, "/admin/external-results"));
    redirect(buildExternalResultsPath(locale as AppLocale, EXTERNAL_MATCH_RESULT_STATES.PENDING_CONFIRMATION, { success: "synced" }));
  }

  const latestImportSyncRun = getLatestSyncRunByType(syncRuns, "IMPORT");
  const latestResultsSyncRun = getLatestSyncRunByType(syncRuns, "RESULTS");

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl">
      <section className="space-y-6 py-2 sm:py-4">
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
              {t("adminOnlyBadge")}
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{t("pageTitle")}</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              {t("permissionNotice", { permission: "matches:finalize" })}
            </p>
          </div>

          {resolvedSearchParams?.error ? (
            <div role="alert" aria-live="assertive" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {getSearchErrorMessage(resolvedSearchParams.error, t)}
            </div>
          ) : null}

          {resolvedSearchParams?.success ? (
            <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {getSearchSuccessMessage(resolvedSearchParams.success, t)}
            </div>
          ) : null}

          {loadErrorMessage ? (
            <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {loadErrorMessage}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <p className="mb-4 text-sm font-medium text-slate-300">{t("actions.syncSectionBadge")}</p>
            <div className="flex flex-wrap gap-3">
              <form action={importTournamentAction} className="inline">
                <button
                  type="submit"
                  className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                >
                  {t("actions.importTournament")}
                </button>
              </form>
              <form action={syncResultsAction} className="inline">
                <button
                  type="submit"
                  className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                >
                  {t("actions.syncResults")}
                </button>
              </form>
            </div>
          </div>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("syncSection.badge")}</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{t("syncSection.title")}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {t("syncSection.subtitle")}
                </p>
              </div>
              <p className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
                {t("syncSection.runs", { count: syncRuns.length })}
              </p>
            </div>

            {syncRunsLoadErrorMessage ? (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {syncRunsLoadErrorMessage}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {[
                { label: formatSyncTypeLabel("IMPORT", t), syncRun: latestImportSyncRun },
                { label: formatSyncTypeLabel("RESULTS", t), syncRun: latestResultsSyncRun },
              ].map(({ label, syncRun }) => (
                <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                  {syncRun ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{formatSyncTypeLabel(syncRun.syncType, t)}</p>
                          <p className="mt-1 break-all text-sm font-semibold text-white">{syncRun.syncRunId}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getSyncRunStatusClassName(syncRun.status)}`}>
                          {formatSyncStatusLabel(syncRun.status, t)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("syncRunCard.imported")}</p>
                          <p className="mt-1 font-bold text-white">{syncRun.importedCount}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("syncRunCard.updated")}</p>
                          <p className="mt-1 font-bold text-white">{syncRun.updatedCount}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("syncRunCard.staged")}</p>
                          <p className="mt-1 font-bold text-white">{syncRun.stagedCount}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("syncRunCard.skipped")}</p>
                          <p className="mt-1 font-bold text-white">{syncRun.skippedCount}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 text-xs text-slate-400 sm:grid-cols-2">
                        <p>{t("syncRunCard.started")}: {formatDateTime(syncRun.startedAt, locale)}</p>
                        <p>{t("syncRunCard.completed")}: {formatDateTime(syncRun.completedAt, locale)}</p>
                      </div>

                      {syncRun.errorMessage ? (
                        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-100">
                          {syncRun.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm leading-6 text-slate-300">{t("syncRunCard.noSyncYet", { type: label })}</div>
                  )}
                </div>
              ))}
            </div>

            {syncRuns.length > 2 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("syncRunCard.recentHistory")}</p>
                {syncRuns.slice(2).map((syncRun) => (
                  <div key={syncRun.syncRunId} className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">
                        {formatSyncTypeLabel(syncRun.syncType, t)} · {formatSyncStatusLabel(syncRun.status, t)}
                      </p>
                      <p className="truncate text-xs text-slate-500">{syncRun.syncRunId}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(syncRun.startedAt, locale)} · {t("syncRunCard.imported")} {syncRun.importedCount} · {t("syncRunCard.updated")} {syncRun.updatedCount} · {t("syncRunCard.staged")} {syncRun.stagedCount}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{t("diagnosticsSection.badge")}</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{t("diagnosticsSection.title")}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {t("diagnosticsSection.subtitle")}
                </p>
              </div>
              <p className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-300">
                {t("diagnosticsSection.matches", { count: matchDiagnostics.length })}
              </p>
            </div>

            {diagnosticsLoadErrorMessage ? (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                {diagnosticsLoadErrorMessage}
              </div>
            ) : null}

            {matchDiagnostics.length > 0 ? (
              <div className="mt-5 space-y-3">
                {matchDiagnostics.map((diagnostic) => (
                  <article key={diagnostic.matchId} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-white">
                          {t("matchup", { homeTeam: diagnostic.homeTeamName, awayTeam: diagnostic.awayTeamName })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {diagnostic.stage ?? t("resultCard.stageUnavailable")}
                          {diagnostic.groupName ? ` · ${diagnostic.groupName}` : ""} · {formatDateTime(diagnostic.kickoffAt, locale)}
                        </p>
                        <p className="break-all text-xs text-slate-500">{t("diagnosticCard.internalMatchId")}: {diagnostic.matchId}</p>
                      </div>

                      <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[520px]">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("diagnosticCard.externalRef")}</p>
                          <p className="mt-1 break-all font-semibold text-white">{diagnostic.externalMatchId ?? t("diagnosticCard.missing")}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("diagnosticCard.latestResult")}</p>
                          {diagnostic.latestExternalResult ? (
                            <p className="mt-1 font-semibold text-white">
                              {diagnostic.latestExternalResult.homeScore} - {diagnostic.latestExternalResult.awayScore}
                            </p>
                          ) : (
                            <p className="mt-1 font-semibold text-slate-400">{t("diagnosticCard.missing")}</p>
                          )}
                        </div>
                        <div className={`rounded-2xl border p-3 ${getDiagnosticStatusClassName(diagnostic)}`}>
                          <p className="text-[11px] uppercase tracking-[0.2em] opacity-70">{t("diagnosticCard.providerStatus")}</p>
                          <p className="mt-1 font-semibold">{getDiagnosticStatusLabel(diagnostic, t)}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : diagnosticsLoadErrorMessage ? null : (
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
                {t("diagnosticsSection.emptyState")}
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            {EXTERNAL_MATCH_RESULT_FILTERS.map((state) => {
              const isActive = state === currentState;

              return (
                <Link
                  key={state}
                  href={buildExternalResultsPath(locale as AppLocale, state)}
                  className={
                    isActive
                      ? "rounded-full border border-cyan-300/50 bg-cyan-300/15 px-4 py-2 text-sm font-semibold text-cyan-100"
                      : "rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
                  }
                >
                  {formatStateLabel(state, t)}
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
                  t={t}
                  locale={locale}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-sm text-slate-300 shadow-xl shadow-slate-950/30">
              {t("emptyState.noResults", { state: formatStateLabel(currentState, t) })}
            </div>
          )}
      </section>
    </main>
  );
}
