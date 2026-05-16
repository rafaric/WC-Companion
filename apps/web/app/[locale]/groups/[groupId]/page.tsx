import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth0 } from "@/lib/auth0";
import {
	ApiError,
	getCurrentUserProfile,
	getGroupRanking,
	getMyGroups,
	type MyGroupView,
	type RankingEntry,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { buildPageMetadata } from "@/lib/metadata";
import { getFriendlyDisplayName } from "@/lib/user-display";
import { CopyInviteCodeButton } from "../copy-invite-code-button";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import { getLocalizedPath, type AppLocale } from "@/lib/locale-nav";

interface GroupDetailPageProps {
	params: Promise<{ groupId: string; locale: string }>;
}

interface RankingStatsProps {
	label: string;
	value: number;
}

export async function generateMetadata({
	params,
}: GroupDetailPageProps): Promise<ReturnType<typeof buildPageMetadata>> {
	const { groupId, locale } = await params;
	const t = await getTranslations("metadata.groupDetail");

	return buildPageMetadata({
		title: t("title"),
		description: t("description"),
		index: false,
		locale,
		path: `/groups/${groupId}`,
	});
}

function RankingStats({ label, value }: RankingStatsProps) {
	return (
		<div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-right">
			<p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
				{label}
			</p>
			<p className="mt-1 text-base font-bold text-white">{value}</p>
		</div>
	);
}

function formatLastScoredAt(
	value: string | null,
	locale: string,
	emptyLabel: string,
): string {
	if (!value) {
		return emptyLabel;
	}

	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getLeader(ranking: RankingEntry[]): RankingEntry | null {
	return ranking[0] ?? null;
}

function getLatestScoredEntry(ranking: RankingEntry[]): RankingEntry | null {
	return (
		ranking
			.filter((entry) => entry.lastScoredAt !== null)
			.slice()
			.sort(
				(left, right) =>
					new Date(right.lastScoredAt ?? 0).getTime() -
					new Date(left.lastScoredAt ?? 0).getTime(),
			)[0] ?? null
	);
}

function getPointsBehindLeader(
	currentUserEntry: RankingEntry | null,
	leader: RankingEntry | null,
): number | null {
	if (
		!currentUserEntry ||
		!leader ||
		currentUserEntry.userId === leader.userId
	) {
		return null;
	}

	return Math.max(leader.totalPoints - currentUserEntry.totalPoints, 0);
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

function PodiumCard({
	entry,
	isCurrentUser,
	currentUserId,
	currentUserDisplayName,
	labels,
}: {
	entry: RankingEntry;
	isCurrentUser: boolean;
	currentUserId: string | null;
	currentUserDisplayName: string;
	labels: {
		leader: string;
		you: string;
		pts: string;
		exactLabel: string;
		predLabel: string;
		points: (count: number) => string;
		exact: (count: number) => string;
		playerFallback: (position: number) => string;
	};
}) {
	const isLeader = entry.position === 1;
	const displayName = getRankingDisplayName(
		entry,
		currentUserId,
		currentUserDisplayName,
		labels.playerFallback,
	);

	return (
		<article
			className={cn(
				"rounded-3xl border p-4 shadow-xl shadow-slate-950/20 transition",
				isLeader
					? "border-amber-300/30 bg-gradient-to-br from-amber-400/15 via-slate-900/80 to-slate-950 shadow-amber-950/20"
					: isCurrentUser
						? "border-cyan-400/40 bg-cyan-400/10"
						: "border-slate-800 bg-slate-950/60",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p
						className={cn(
							"text-xs uppercase tracking-[0.2em]",
							isLeader ? "text-amber-200" : "text-slate-500",
						)}
					>
						{isLeader ? labels.leader : `#${entry.position}`}
					</p>
					<p className="mt-1 truncate text-lg font-black text-white">
						{displayName}
					</p>
					<p
						className={cn(
							"mt-1 text-sm",
							isLeader ? "text-amber-100/80" : "text-slate-400",
						)}
					>
						{labels.points(entry.totalPoints)} ·{" "}
						{labels.exact(entry.exactPredictions)}
					</p>
				</div>
				{isCurrentUser ? (
					<span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
						{labels.you}
					</span>
				) : null}
			</div>
			<div className="mt-4 grid grid-cols-3 gap-2 text-center">
				<RankingStats label={labels.pts} value={entry.totalPoints} />
				<RankingStats
					label={labels.exactLabel}
					value={entry.exactPredictions}
				/>
				<RankingStats label={labels.predLabel} value={entry.predictionsCount} />
			</div>
		</article>
	);
}

function getRankingErrorKey(
	error: unknown,
): "accessError" | "notFoundError" | "loadError" {
	if (error instanceof ApiError) {
		if (error.status === 401 || error.status === 403) {
			return "accessError";
		}

		if (error.status === 404) {
			return "notFoundError";
		}
	}

	return "loadError";
}

function RankingRow({
	entry,
	isCurrentUser,
	currentUserId,
	currentUserDisplayName,
	labels,
}: {
	entry: RankingEntry;
	isCurrentUser: boolean;
	currentUserId: string | null;
	currentUserDisplayName: string;
	labels: {
		you: string;
		pts: string;
		exact: (count: number) => string;
		predictions: (count: number) => string;
		playerFallback: (position: number) => string;
	};
}) {
	const displayName = getRankingDisplayName(
		entry,
		currentUserId,
		currentUserDisplayName,
		labels.playerFallback,
	);

	return (
		<li
			className={cn(
				"flex items-center justify-between gap-4 rounded-2xl border px-4 py-3",
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
							{labels.you}
						</span>
					) : null}
				</div>
				<p className="text-xs text-slate-500">
					{labels.exact(entry.exactPredictions)} ·{" "}
					{labels.predictions(entry.predictionsCount)}
				</p>
			</div>
			<p className="shrink-0 text-lg font-black text-cyan-300">
				{entry.totalPoints} {labels.pts}
			</p>
		</li>
	);
}

export default async function GroupDetailPage({
	params,
}: GroupDetailPageProps) {
	const { groupId, locale } = await params;
	const appLocale = locale as AppLocale;
	const t = await getTranslations("groups");

	const session = await auth0.getSession();

	if (!session) {
		redirect(
			`/auth/login?returnTo=${getLocalizedPath(appLocale, `/groups/${groupId}`)}`,
		);
	}

	let accessToken: string;

	try {
		accessToken = (await auth0.getAccessToken()).token;
	} catch {
		redirect(
			`/auth/login?returnTo=${getLocalizedPath(appLocale, `/groups/${groupId}`)}`,
		);
	}

	const tournamentSlug = await resolveTournamentSlug();

	const [currentUserProfile, myGroups, rankingResult] = await Promise.all([
		getCurrentUserProfile(accessToken).catch(() => null),
		getMyGroups(accessToken, tournamentSlug).catch(() => [] as MyGroupView[]),
		getGroupRanking(accessToken, groupId)
			.then((ranking) => ({
				ranking,
				errorKey: null as "accessError" | "notFoundError" | "loadError" | null,
			}))
			.catch((error: unknown) => ({
				ranking: [] as RankingEntry[],
				errorKey: getRankingErrorKey(error),
			})),
	]);

	const group = myGroups.find((candidate) => candidate.id === groupId) ?? null;
	const currentUserRankingEntry = currentUserProfile
		? (rankingResult.ranking.find(
				(entry) => entry.userId === currentUserProfile.id,
			) ?? null)
		: null;
	const leader = getLeader(rankingResult.ranking);
	const latestScoredEntry = getLatestScoredEntry(rankingResult.ranking);
	const podiumEntries = rankingResult.ranking.slice(0, 3);
	const remainingEntries = rankingResult.ranking.slice(3);
	const scoredPlayersCount = rankingResult.ranking.filter(
		(entry) => entry.lastScoredAt !== null,
	).length;
	const isSingleMemberGroup = rankingResult.ranking.length === 1;
	const currentUserDisplayName = currentUserProfile
		? getFriendlyDisplayName(session.user, currentUserProfile)
		: t("common.you");
	const currentUserId = currentUserProfile?.id ?? null;
	const playerFallback = (position: number) =>
		t("common.playerFallback", { position });
	const leaderDisplayName = leader
		? getRankingDisplayName(
				leader,
				currentUserId,
				currentUserDisplayName,
				playerFallback,
			)
		: null;
	const latestScoredDisplayName = latestScoredEntry
		? getRankingDisplayName(
				latestScoredEntry,
				currentUserId,
				currentUserDisplayName,
				playerFallback,
			)
		: null;
	const rowLabels = {
		you: t("common.you"),
		pts: t("common.pts"),
		exact: (count: number) => t("common.exact", { count }),
		predictions: (count: number) => t("common.predictions", { count }),
		playerFallback,
	};
	const podiumLabels = {
		...rowLabels,
		leader: t("detail.leader"),
		exactLabel: t("detail.exactLabel"),
		predLabel: t("detail.predictionsLabel"),
		points: (count: number) => t("common.points", { count }),
	};

	const positionContext = (() => {
		if (!currentUserRankingEntry) {
			return t("detail.positionNoEntry");
		}

		const pointsBehind = getPointsBehindLeader(currentUserRankingEntry, leader);

		if (pointsBehind === null) {
			return t("detail.positionLeading");
		}

		if (pointsBehind === 0) {
			return t("detail.positionTied");
		}

		return t("detail.positionBehind", {
			points: t("common.points", { count: pointsBehind }),
		});
	})();

	return (
		<main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl">
			<section className="space-y-6 py-2 sm:py-4">
				<div className="space-y-3">
					<div className="flex items-start justify-between gap-3">
						<p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
							{t("detail.eyebrow")}
						</p>
						{group ? (
							<span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300 sm:hidden">
								{group.role === "OWNER" ? t("roles.owner") : t("roles.member")}
							</span>
						) : null}
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
						<h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
							{group?.name ?? t("detail.fallbackGroupName", { groupId })}
						</h1>
						{group ? (
							<span className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300 sm:inline-flex">
								{group.role === "OWNER" ? t("roles.owner") : t("roles.member")}
							</span>
						) : null}
					</div>
					<p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
						{t("detail.description")}
					</p>
					{group ? (
						<div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
							<span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1">
								{t("common.memberCount", { count: group.memberCount })}
							</span>
							<CopyInviteCodeButton inviteCode={group.inviteCode} />
						</div>
					) : null}
				</div>

				{rankingResult.errorKey ? (
					<div
						role="alert"
						aria-live="assertive"
						className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
					>
						{t(`detail.${rankingResult.errorKey}`)}
					</div>
				) : null}

				{isSingleMemberGroup ? (
					<section className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/15 via-slate-900/80 to-slate-950 p-5 shadow-xl shadow-amber-950/20">
						<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
							<div className="max-w-2xl">
								<p className="text-xs uppercase tracking-[0.2em] text-amber-200">
									{t("detail.inviteFirstRival")}
								</p>
								<h2 className="mt-2 text-2xl font-black text-white">
									{t("detail.aloneTitle")}
								</h2>
								<p className="mt-2 text-sm leading-6 text-amber-100/80">
									{group
										? t("detail.shareCodeWithFriends")
										: t("detail.inviteFriendsFromList")}{" "}
									{t("detail.singleMemberSuffix")}
								</p>
							</div>

							<div className="rounded-3xl border border-amber-300/20 bg-slate-950/55 p-4 lg:min-w-80">
								<p className="text-xs uppercase tracking-[0.2em] text-amber-200">
									{t("detail.shareThisCode")}
								</p>
								<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<p className="font-mono text-2xl font-black tracking-[0.18em] text-white">
										{group?.inviteCode ?? t("common.unavailable")}
									</p>
									{group ? (
										<CopyInviteCodeButton inviteCode={group.inviteCode} />
									) : null}
								</div>
								<p className="mt-3 text-xs leading-5 text-amber-100/70">
									{t("detail.friendsCanJoin")}
								</p>
							</div>
						</div>
					</section>
				) : null}

				<div className="grid gap-4 md:grid-cols-3">
					<div className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-400/15 via-slate-900/80 to-slate-950 p-5 shadow-2xl shadow-amber-950/20 md:col-span-1">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="text-xs uppercase tracking-[0.2em] text-amber-200">
									{t("detail.leader")}
								</p>
								{leader ? (
									<>
										<p className="mt-2 text-3xl font-black text-white">
											#{leader.position}
										</p>
										<p className="mt-1 truncate text-xl font-semibold text-white">
											{leaderDisplayName}
										</p>
										<p className="mt-1 text-sm text-amber-100/80">
											{t("common.points", { count: leader.totalPoints })}
										</p>
									</>
								) : (
									<p className="mt-2 text-sm leading-6 text-amber-50/80">
										{t("detail.noLeaderYet")}
									</p>
								)}
							</div>
							{leader ? (
								<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl border border-amber-300/30 bg-slate-950/70 shadow-lg shadow-amber-500/10">
									<span className="text-xl font-black text-amber-200">#1</span>
								</div>
							) : null}
						</div>
						{leader ? (
							<p className="mt-4 text-sm leading-6 text-amber-50/80">
								{t("detail.leaderPace")}
							</p>
						) : null}
					</div>
					<div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
						<p className="text-xs uppercase tracking-[0.2em] text-slate-500">
							{t("detail.latestScoringUpdate")}
						</p>
						{latestScoredEntry ? (
							<>
								<div className="mt-2 flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="truncate text-xl font-black text-white">
											{latestScoredDisplayName}
										</p>
										<p className="mt-1 text-sm text-slate-300">
											#{latestScoredEntry.position} ·{" "}
											{t("common.points", {
												count: latestScoredEntry.totalPoints,
											})}
										</p>
									</div>
									<div className="shrink-0 text-right">
										<p className="text-sm font-medium text-emerald-300">
											{t("common.exact", {
												count: latestScoredEntry.exactPredictions,
											})}
										</p>
										<p className="mt-1 text-xs text-slate-500">
											{formatLastScoredAt(
												latestScoredEntry.lastScoredAt,
												locale,
												t("detail.noScoredPredictions"),
											)}
										</p>
									</div>
								</div>
								<p className="mt-3 text-xs leading-5 text-slate-400">
									{t("detail.latestScoringDescription")}
								</p>
							</>
						) : (
							<p className="mt-2 text-sm leading-6 text-slate-300">
								{t("detail.noScoredPredictions")}
							</p>
						)}
					</div>
					<div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
						<p className="text-xs uppercase tracking-[0.2em] text-slate-500">
							{t("detail.competition")}
						</p>
						<p className="mt-2 text-3xl font-black text-white">
							{scoredPlayersCount}/{rankingResult.ranking.length}
						</p>
						<p className="mt-1 text-sm text-slate-300">
							{t("detail.playersWithScoredPredictions")}
						</p>
					</div>
				</div>

				<div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-slate-500">
								{t("detail.ranking")}
							</p>
							<h2 className="mt-1 text-lg font-semibold text-white">
								{t("detail.currentPositions")}
							</h2>
						</div>
						<p className="text-sm text-slate-400">
							{t("detail.players", { count: rankingResult.ranking.length })}
						</p>
					</div>

					{currentUserRankingEntry ? (
						<div className="mt-4 overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 via-slate-900/80 to-violet-400/10 p-4 shadow-xl shadow-cyan-950/20">
							<div className="flex items-start justify-between gap-4">
								<div className="flex min-w-0 items-center gap-3">
									<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/30 bg-slate-950/70 shadow-lg shadow-cyan-500/10">
										<span className="text-2xl font-black text-cyan-200">
											#{currentUserRankingEntry.position}
										</span>
									</div>
									<div className="min-w-0">
										<p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
											{t("detail.yourStanding")}
										</p>
										<p className="mt-1 truncate text-base font-semibold text-white">
											{currentUserDisplayName}
										</p>
										<p className="text-xs text-cyan-100/70">
											{positionContext}
										</p>
									</div>
								</div>
								<div className="shrink-0 text-right">
									<p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
										{t("detail.pointsLabel")}
									</p>
									<p className="mt-1 text-3xl font-black tabular-nums text-white">
										{currentUserRankingEntry.totalPoints}
									</p>
									<p className="text-xs font-semibold text-cyan-100/70">
										{t("common.pts")}
									</p>
								</div>
							</div>
							<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
								<div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
									<p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
										{t("detail.exactLabel")}
									</p>
									<p className="mt-1 text-lg font-bold text-white">
										{currentUserRankingEntry.exactPredictions}
									</p>
								</div>
								<div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
									<p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
										{t("detail.predictionsLabel")}
									</p>
									<p className="mt-1 text-lg font-bold text-white">
										{currentUserRankingEntry.predictionsCount}
									</p>
								</div>
								<div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
									<p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
										{t("detail.positionLabel")}
									</p>
									<p className="mt-1 text-lg font-bold text-white">
										#{currentUserRankingEntry.position}
									</p>
								</div>
							</div>
						</div>
					) : null}

					{podiumEntries.length > 0 ? (
						<div className="mt-4 grid gap-3 md:grid-cols-3">
							{podiumEntries.map((entry) => (
								<PodiumCard
									key={entry.userId}
									entry={entry}
									isCurrentUser={entry.userId === currentUserId}
									currentUserId={currentUserId}
									currentUserDisplayName={currentUserDisplayName}
									labels={podiumLabels}
								/>
							))}
						</div>
					) : null}

					{remainingEntries.length > 0 ? (
						<div className="mt-5">
							<div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
								<span className="h-px flex-1 bg-slate-800" />
								{t("detail.remainingPositions")}
								<span className="h-px flex-1 bg-slate-800" />
							</div>
							<ul className="mt-4 space-y-3">
								{remainingEntries.map((entry) => (
									<RankingRow
										key={entry.userId}
										entry={entry}
										isCurrentUser={entry.userId === currentUserId}
										currentUserId={currentUserId}
										currentUserDisplayName={currentUserDisplayName}
										labels={rowLabels}
									/>
								))}
							</ul>
						</div>
					) : rankingResult.ranking.length > 0 ? null : (
						<div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
							{t("detail.noRankingData")}
						</div>
					)}
				</div>
			</section>
		</main>
	);
}
