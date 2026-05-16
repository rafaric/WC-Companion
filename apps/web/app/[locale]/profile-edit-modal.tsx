"use client";

import { useRef, useEffect, useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

import type { CurrentUserProfile, TeamView } from "@/lib/api";
import { PROFILE_COUNTRY_OPTIONS, PROFILE_LANGUAGE_OPTIONS } from "@/lib/profile";
import { parseTournamentSlug, TOURNAMENT_COOKIE_NAME } from "@/lib/tournament-context";
import { updateProfile } from "./actions/update-profile";

interface ProfileEditModalProps {
  currentUserProfile: CurrentUserProfile;
  availableTeams: TeamView[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Fetches the current tournament's teams on the client side.
 * This ensures the modal always uses fresh data for the currently selected tournament,
 * avoiding stale team options when users switch tournaments.
 */
function getSelectedTournamentSlugFromDocument(): string | null {
  const rawCookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TOURNAMENT_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  return parseTournamentSlug(rawCookie ?? null);
}

async function fetchCurrentTournamentTeams(): Promise<TeamView[]> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  const tournamentSlug = getSelectedTournamentSlugFromDocument();
  const url = new URL("/tournaments/active/matches", API_BASE_URL);

  if (tournamentSlug) {
    url.searchParams.set("tournamentSlug", tournamentSlug);
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    console.error("Failed to fetch tournament teams:", response.status);
    return [];
  }

  const matches: Array<{ homeTeam: TeamView; awayTeam: TeamView }> = await response.json();

  // Extract unique teams from matches
  const teamsById = new Map<string, TeamView>();
  for (const match of matches) {
    if (!teamsById.has(match.homeTeam.id)) {
      teamsById.set(match.homeTeam.id, match.homeTeam);
    }
    if (!teamsById.has(match.awayTeam.id)) {
      teamsById.set(match.awayTeam.id, match.awayTeam);
    }
  }

  return Array.from(teamsById.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations("profileEdit");

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? t("saving") : t("saveChanges")}
    </button>
  );
}

const initialState = {
  error: "",
};

export function ProfileEditModal({
  currentUserProfile,
  availableTeams: layoutTeams,
  isOpen,
  onClose,
}: ProfileEditModalProps) {
  const locale = useLocale() as "en" | "es";
  const t = useTranslations("profileEdit");
  const [state, formAction] = useActionState(
    async (prevState: { error: string } | undefined, formData: FormData) =>
      updateProfile(prevState, formData, locale),
    initialState,
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [clientIsOpen, setClientIsOpen] = useState(false);
  const [selectedFavoriteTeamId, setSelectedFavoriteTeamId] = useState(currentUserProfile.favoriteTeamId ?? "");

  // Track if we've successfully fetched fresh teams for this open session
  const [freshTeams, setFreshTeams] = useState<TeamView[] | null>(null);
  const [isLoadingFreshTeams, setIsLoadingFreshTeams] = useState(false);

  const availableTeams = freshTeams ?? layoutTeams;
  const savedFavoriteTeamIsAvailable = availableTeams.some((team) => team.id === currentUserProfile.favoriteTeamId);
  const selectedFavoriteTeamIsAvailable = availableTeams.some((team) => team.id === selectedFavoriteTeamId);

  // Fetch fresh teams when modal opens to ensure we have current tournament's teams
  useEffect(() => {
    if (isOpen && !freshTeams) {
      setIsLoadingFreshTeams(true);
      fetchCurrentTournamentTeams()
        .then((teams) => {
          setFreshTeams(teams);
        })
        .catch((error) => {
          console.error("Failed to fetch fresh teams:", error);
          // Fall back to layout teams on error
        })
        .finally(() => {
          setIsLoadingFreshTeams(false);
        });
    }

    // Reset fresh teams when modal closes
    if (!isOpen) {
      setFreshTeams(null);
      setSelectedFavoriteTeamId(currentUserProfile.favoriteTeamId ?? "");
    }
  }, [isOpen, freshTeams, currentUserProfile.favoriteTeamId]);

  useEffect(() => {
    if (availableTeams.length === 0) {
      return;
    }

    if (selectedFavoriteTeamId && selectedFavoriteTeamIsAvailable) {
      return;
    }

    if (savedFavoriteTeamIsAvailable && currentUserProfile.favoriteTeamId) {
      setSelectedFavoriteTeamId(currentUserProfile.favoriteTeamId);
      return;
    }

    setSelectedFavoriteTeamId("");
  }, [
    availableTeams,
    currentUserProfile.favoriteTeamId,
    savedFavoriteTeamIsAvailable,
    selectedFavoriteTeamId,
    selectedFavoriteTeamIsAvailable,
  ]);

  // Handle modal open/close animation
  useEffect(() => {
    if (isOpen) {
      setClientIsOpen(true);
      closeButtonRef.current?.focus();
    } else {
      const timer = setTimeout(() => setClientIsOpen(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!clientIsOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clientIsOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (clientIsOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [clientIsOpen]);

  // Close modal on successful submission - track submission start and check for success
  const [submitted, setSubmitted] = useState(false);
  const mustPickNewTeam = !savedFavoriteTeamIsAvailable && currentUserProfile.favoriteTeamId !== null;

  useEffect(() => {
    if (submitted && state === undefined) {
      // Success - state is undefined after successful server action
      onClose();
      setSubmitted(false);
    }
  }, [submitted, state, onClose]);

  function handleSubmit() {
    setSubmitted(true);
  }

  if (!clientIsOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl shadow-cyan-950/20"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 id="profile-edit-title" className="text-lg font-bold text-white">
            {t("title")}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ✕
            </span>
          </button>
        </div>

        <form action={formAction} onSubmit={handleSubmit} className="space-y-5 p-6">
          <input type="hidden" name="favoriteTeamId" value={selectedFavoriteTeamId} />

          {state?.error && (
            <div
              role="alert"
              className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
            >
              {state.error}
            </div>
          )}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">{t("country")}</span>
            <select
              name="country"
              defaultValue={currentUserProfile.country ?? ""}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              required
            >
              <option value="" disabled>
                {t("selectCountry")}
              </option>
              {PROFILE_COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">{t("preferredLanguage")}</span>
            <select
              name="preferredLanguage"
              defaultValue={currentUserProfile.preferredLanguage ?? "es"}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
              required
            >
              {PROFILE_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">{t("favoriteTeam")}</span>
            {mustPickNewTeam && (
              <p className="text-sm leading-5 text-amber-200">
                {t("mustPickNewTeam")}
              </p>
            )}
            {!mustPickNewTeam && !savedFavoriteTeamIsAvailable && currentUserProfile.favoriteTeamId && (
              <p className="text-xs leading-5 text-slate-400">
                {t("changeFavoriteTeam")}
              </p>
            )}
            {isLoadingFreshTeams ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400" />
                {t("loadingTeams")}
              </div>
            ) : (
              <select
                key={availableTeams.map((team) => team.id).join(":")}
                value={selectedFavoriteTeamId}
                onChange={(event) => setSelectedFavoriteTeamId(event.target.value)}
                className={`w-full rounded-2xl border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50 ${
                  mustPickNewTeam ? "border-amber-400/50" : "border-slate-800"
                }`}
                required
                disabled={availableTeams.length === 0}
              >
                <option value="" disabled>
                  {availableTeams.length === 0 ? t("noTeamsAvailable") : mustPickNewTeam ? t("mustSelectTeam") : t("selectTeam")}
                </option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.shortName ? `${team.name} (${team.shortName})` : team.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              {t("cancel")}
            </button>
            <SubmitButton disabled={availableTeams.length === 0 || isLoadingFreshTeams || !selectedFavoriteTeamIsAvailable} />
          </div>
        </form>
      </div>
    </div>
  );
}
