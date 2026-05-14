"use client";

import { useState, useEffect, useRef } from "react";
import { buildTournamentCookieValue, TOURNAMENT_COOKIE_NAME } from "@/lib/tournament-context";
import { cn } from "@/lib/cn";

// Tournament type - kept in sync with api.ts
interface Tournament {
  id: string;
  name: string;
  slug: string;
  year: number;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
}

// Client-side function to fetch tournaments (used when not provided via SSR)
async function fetchTournaments(): Promise<Tournament[]> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  const response = await fetch(`${API_BASE_URL}/tournaments`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch tournaments: ${response.status}`);
  }
  return response.json();
}

interface TournamentSelectorProps {
  /** Initial selected tournament slug from server */
  initialSlug?: string | null;
  /** Initial list of tournaments for SSR/hydration */
  initialTournaments?: Tournament[];
  /** CSS class name for container */
  className?: string;
}

/**
 * Tournament selector dropdown component.
 * Allows users to switch between available tournaments.
 * Persists selection in a cookie and triggers page refresh.
 */
export function TournamentSelector({
  initialSlug,
  initialTournaments = [],
  className,
}: TournamentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load tournaments on mount if not provided via SSR
  useEffect(() => {
    if (tournaments.length === 0) {
      setIsLoading(true);
      fetchTournaments()
        .then(setTournaments)
        .catch((error) => {
          console.error("Failed to load tournaments:", error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [tournaments.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  /**
   * Handle tournament selection.
   * Writes cookie and triggers page refresh to apply the new selection.
   */
  async function handleSelect(tournament: Tournament) {
    if (tournament.slug === selectedSlug) {
      setIsOpen(false);
      return;
    }

    // Write cookie using shared helper
    document.cookie = buildTournamentCookieValue(tournament.slug);

    // Update local state
    setSelectedSlug(tournament.slug);
    setIsOpen(false);

    // Refresh the page to apply the new selection
    window.location.reload();
  }

  // Find the selected tournament object
  const selectedTournament = tournaments.find((t) => t.slug === selectedSlug);

  // Show loading state
  if (isLoading && tournaments.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-8 w-32 animate-pulse rounded-md bg-slate-800" />
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={cn("relative inline-block", className)}>
      {/* Selector button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-sm",
          "text-slate-200 transition-colors hover:bg-slate-800 hover:border-slate-600",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Selected tournament: ${selectedTournament?.name ?? "None"}`}
      >
        <svg
          className="h-4 w-4 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span className="truncate max-w-[120px]">
          {selectedTournament?.name ?? "Select Tournament"}
        </span>
        <svg
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform",
            isOpen && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <ul
          role="listbox"
          className={cn(
            "absolute right-0 z-50 mt-1 max-h-64 min-w-[180px] overflow-auto rounded-md",
            "border border-slate-700 bg-slate-900/95 py-1 shadow-lg backdrop-blur-sm",
            "animate-in fade-in zoom-in-95 duration-100"
          )}
          aria-label="Tournament options"
        >
          {tournaments.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">
              No tournaments available
            </li>
          ) : (
            tournaments.map((tournament) => (
              <li key={tournament.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(tournament)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    "transition-colors",
                    tournament.slug === selectedSlug
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                  )}
                  aria-selected={tournament.slug === selectedSlug}
                  role="option"
                >
                  {/* Status indicator for ACTIVE tournaments */}
                  {tournament.status === "ACTIVE" && (
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        tournament.slug === selectedSlug
                          ? "bg-cyan-400"
                          : "bg-emerald-400"
                      )}
                      aria-label="Active tournament"
                    />
                  )}
                  <span className="flex-1 truncate">{tournament.name}</span>
                  <span className="text-xs text-slate-500">{tournament.year}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}