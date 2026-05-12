"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { CurrentUserProfile, TeamView } from "@/lib/api";
import { getFriendlyDisplayName, getFriendlyEmailLabel, type SessionDisplayUser } from "@/lib/user-display";

interface AppChromeProps {
  canAccessExternalResults: boolean;
  children: ReactNode;
  currentUserProfile: CurrentUserProfile | null;
  favoriteTeam: TeamView | null;
  sessionUser: SessionDisplayUser | null;
}

interface NavItem {
  href: string;
  label: string;
}

const AUTHENTICATED_PATH_PREFIXES = ["/admin", "/dashboard", "/groups", "/rankings", "/share"] as const;

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

function isAuthenticatedPath(pathname: string): boolean {
  return AUTHENTICATED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getSectionLabel(pathname: string): string {
  if (pathname.startsWith("/groups/")) {
    return "Group ranking";
  }

  if (pathname.startsWith("/groups")) {
    return "Private groups";
  }

  if (pathname.startsWith("/share")) {
    return "Share cards";
  }

  if (pathname.startsWith("/rankings")) {
    return "Global ranking";
  }

  if (pathname.startsWith("/admin")) {
    return "Admin review";
  }

  return "Predictions dashboard";
}

function getFlagEmoji(code: string | null): string | null {
  if (!code) {
    return null;
  }

  const normalizedCode = code.trim().toUpperCase();

  if (FIFA_FLAG_EMOJI[normalizedCode]) {
    return FIFA_FLAG_EMOJI[normalizedCode];
  }

  if (!/^[A-Z]{2}$/.test(normalizedCode)) {
    return null;
  }

  return String.fromCodePoint(...Array.from(normalizedCode).map((char) => 127397 + char.charCodeAt(0)));
}

export function AppChrome({ canAccessExternalResults, children, currentUserProfile, favoriteTeam, sessionUser }: AppChromeProps) {
  const pathname = usePathname();
  const menuId = useId();
  const firstMenuLinkRef = useRef<HTMLAnchorElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    firstMenuLinkRef.current?.focus();

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  if (!pathname || !isAuthenticatedPath(pathname) || sessionUser === null) {
    return <>{children}</>;
  }

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/groups", label: "Groups" },
    { href: "/share", label: "Share cards" },
    { href: "/rankings", label: "Rankings" },
  ];

  if (canAccessExternalResults) {
    navItems.push({ href: "/admin/external-results", label: "External results" });
  }

  const displayName = getFriendlyDisplayName(sessionUser, currentUserProfile);
  const emailLabel = getFriendlyEmailLabel(sessionUser, currentUserProfile);
  const countryFlag = getFlagEmoji(currentUserProfile?.country ?? null);
  const favoriteTeamFlag = getFlagEmoji(favoriteTeam?.flagCode ?? null) ?? getFlagEmoji(favoriteTeam?.countryCode ?? null);
  const favoriteTeamLabel = favoriteTeam?.shortName ?? "Team";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="worldpredict-aurora absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="fixed inset-x-4 top-4 z-40 mx-auto max-w-6xl rounded-full border border-slate-800/80 bg-slate-900/85 px-4 py-3 shadow-2xl shadow-slate-950/30 backdrop-blur sm:inset-x-6 lg:inset-x-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="inline-flex min-w-0 items-center gap-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
              <Image src="/assets/LogoLong.png" alt="WorldPredict logo" width={144} height={40} priority className="h-8 w-auto object-contain" />
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-400">{getSectionLabel(pathname)}</p>
              </div>
            </Link>

            <nav aria-label="Primary" className="hidden items-center gap-2 md:flex">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                      isActive
                        ? "bg-cyan-400/10 text-cyan-200"
                        : "text-slate-200 hover:bg-slate-800/80 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/auth/logout"
                className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Log out
              </Link>
            </nav>

            <div className="relative md:hidden">
              {menuOpen ? (
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => {
                    setMenuOpen(false);
                    menuButtonRef.current?.focus();
                  }}
                  className="fixed inset-0 z-30 cursor-default bg-slate-950/20"
                />
              ) : null}

              <button
                ref={menuButtonRef}
                type="button"
                aria-controls={menuId}
                aria-expanded={menuOpen}
                aria-haspopup="dialog"
                aria-label={menuOpen ? "Close primary navigation" : "Open primary navigation"}
                onClick={() => setMenuOpen((current) => !current)}
                className="inline-flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <span className="hidden text-right sm:block">
                  <span className="block text-xs font-medium text-white">{displayName}</span>
                  <span className="block text-[11px] text-slate-400">Menu</span>
                </span>
                <span aria-hidden="true" className="text-lg leading-none">☰</span>
              </button>

              {menuOpen ? (
                <div
                  id={menuId}
                  aria-label="Primary navigation"
                  className="absolute right-0 z-40 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur"
                >
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">{emailLabel}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-200">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-2 py-1">
                        <span aria-hidden="true">{countryFlag ?? "🌐"}</span>
                        {currentUserProfile?.country ?? "--"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-2 py-1">
                        <span aria-hidden="true">{favoriteTeamFlag ?? "⚽"}</span>
                        {favoriteTeamLabel}
                      </span>
                    </div>
                  </div>

                  <nav aria-label="Primary" className="mt-3 grid gap-2">
                    {navItems.map((item, index) => {
                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                      return (
                        <Link
                          ref={index === 0 ? firstMenuLinkRef : undefined}
                          key={item.href}
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                            isActive
                              ? "bg-cyan-400/10 text-cyan-200"
                              : "bg-slate-950/60 text-slate-100 hover:bg-slate-800"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}

                    <Link
                      href="/auth/logout"
                      className="rounded-2xl bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                    >
                      Log out
                    </Link>
                  </nav>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex-1 pt-24">{children}</div>
      </div>
    </div>
  );
}
