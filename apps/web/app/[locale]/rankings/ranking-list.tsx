"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { RankingEntry } from "@/lib/api";
import { cn } from "@/lib/cn";

const VISIBLE_RANKING_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 250;

interface RankingListProps {
	currentUserDisplayName: string;
	currentUserId: string | null;
	currentUserRankingEntry: RankingEntry | null;
	ranking: RankingEntry[];
}

function looksTechnicalUsername(username: string): boolean {
	const normalized = username.trim();

	return (
		/^\d+$/.test(normalized) ||
		/^[a-f0-9]{12,}$/i.test(normalized) ||
		/^[a-f0-9-]{20,}$/i.test(normalized) ||
		normalized.startsWith("auth0-")
	);
}

function getRankingDisplayName(
	entry: RankingEntry,
	currentUserId: string | null,
	currentUserDisplayName: string,
	playerFallback: (position: number) => string,
): string {
	if (entry.userId === currentUserId) {
		return currentUserDisplayName;
	}

	if (looksTechnicalUsername(entry.username)) {
		return playerFallback(entry.position);
	}

	return entry.username;
}

function RankingRow({
	currentUserDisplayName,
	currentUserId,
	entry,
}: {
	currentUserDisplayName: string;
	currentUserId: string | null;
	entry: RankingEntry;
}) {
	const t = useTranslations("rankings");
	const isCurrentUser = entry.userId === currentUserId;
	const displayName = getRankingDisplayName(
		entry,
		currentUserId,
		currentUserDisplayName,
		(position) => t("playerFallback", { position }),
	);

	return (
		<li
			className={cn(
				"flex items-start justify-between gap-4 rounded-2xl border px-4 py-3",
				isCurrentUser
					? "border-cyan-400/40 bg-cyan-400/10"
					: "border-slate-800 bg-slate-950/60",
			)}
		>
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<p className="truncate font-semibold text-white">
						#{entry.position} {displayName}
					</p>
					{isCurrentUser ? (
						<span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
							{t("you")}
						</span>
					) : null}
				</div>
				<p className="text-xs text-slate-500">
					{t("rowSummary", {
						exact: entry.exactPredictions,
						predictions: entry.predictionsCount,
					})}
				</p>
			</div>
			<p className="text-lg font-black text-cyan-300">
				{entry.totalPoints} {t("pts")}
			</p>
		</li>
	);
}

export function RankingList({
	currentUserDisplayName,
	currentUserId,
	currentUserRankingEntry,
	ranking,
}: RankingListProps) {
	const t = useTranslations("rankings");
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const visibleRanking = ranking.slice(0, VISIBLE_RANKING_LIMIT);
	const currentUserInVisibleRanking = currentUserRankingEntry
		? visibleRanking.some(
				(entry) => entry.userId === currentUserRankingEntry.userId,
			)
		: false;

	useEffect(() => {
		const timeoutId = window.setTimeout(
			() => setDebouncedQuery(query.trim().toLowerCase()),
			SEARCH_DEBOUNCE_MS,
		);

		return () => window.clearTimeout(timeoutId);
	}, [query]);

	const filteredRanking = debouncedQuery
		? ranking.filter((entry) => {
				const displayName = getRankingDisplayName(
					entry,
					currentUserId,
					currentUserDisplayName,
					(position) => t("playerFallback", { position }),
				).toLowerCase();
				return (
					displayName.includes(debouncedQuery) ||
					entry.username.toLowerCase().includes(debouncedQuery) ||
					String(entry.position).includes(debouncedQuery)
				);
			})
		: visibleRanking;

	return (
		<>
			<label className="mt-4 block space-y-2">
				<span className="px-2 text-sm font-medium text-slate-200">
					{t("searchPlayers")}
				</span>
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={t("searchPlaceholder")}
					className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
				/>
			</label>

			{filteredRanking.length > 0 ? (
				<ul className="mt-4 space-y-3">
					{filteredRanking.map((entry) => (
						<RankingRow
							key={entry.userId}
							currentUserDisplayName={currentUserDisplayName}
							currentUserId={currentUserId}
							entry={entry}
						/>
					))}
				</ul>
			) : (
				<div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
					{t("noSearchResults")}
				</div>
			)}

			{!debouncedQuery &&
			currentUserRankingEntry &&
			!currentUserInVisibleRanking ? (
				<div className="mt-4 space-y-3">
					<div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
						<span className="h-px flex-1 bg-slate-800" />
						{t("yourPosition")}
						<span className="h-px flex-1 bg-slate-800" />
					</div>
					<RankingRow
						currentUserDisplayName={currentUserDisplayName}
						currentUserId={currentUserId}
						entry={currentUserRankingEntry}
					/>
				</div>
			) : null}
		</>
	);
}
