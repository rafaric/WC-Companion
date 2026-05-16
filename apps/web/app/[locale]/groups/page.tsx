import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth0 } from "@/lib/auth0";
import {
	ApiError,
	createGroup,
	getActiveTournament,
	getCurrentUserProfile,
	getMyGroups,
	joinGroup,
	type GroupView,
	type MyGroupView,
} from "@/lib/api";
import { buildPageMetadata } from "@/lib/metadata";
import { isProfileComplete } from "@/lib/profile";
import { CopyInviteCodeButton } from "./copy-invite-code-button";
import { GroupActionTabs } from "./group-action-tabs";
import { resolveTournamentSlug } from "@/lib/resolve-tournament-slug";
import { getLocalizedPath, type AppLocale } from "@/lib/locale-nav";

const GROUP_ERROR_MESSAGE_KEYS = {
	invalid_input: "invalidInput",
	not_found: "notFound",
	session_expired: "sessionExpired",
	create_failed: "createFailed",
	join_failed: "joinFailed",
} as const;

const GROUP_SUCCESS_MESSAGE_KEYS = {
	created: "created",
	joined: "joined",
} as const;

type GroupsSearchParams = {
	error?: string;
	success?: string;
};

interface GroupsPageProps {
	searchParams?: Promise<GroupsSearchParams>;
	params: Promise<{ locale: string }>;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<ReturnType<typeof buildPageMetadata>> {
	const { locale } = await params;
	const t = await getTranslations("metadata.groups");

	return buildPageMetadata({
		title: t("title"),
		description: t("description"),
		index: false,
		locale,
		path: "/groups",
	});
}

function formatCreatedAt(createdAt: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(createdAt));
}

function getGroupActionErrorCode(
	error: unknown,
	action: "create" | "join",
): string {
	if (!(error instanceof ApiError)) {
		return `${action}_failed`;
	}

	if (error.status === 401 || error.status === 403) {
		return "session_expired";
	}

	if (error.status === 404) {
		return "not_found";
	}

	if (error.status === 400) {
		return "invalid_input";
	}

	return `${action}_failed`;
}

interface GroupCardProps {
	group: MyGroupView;
	locale: AppLocale;
}

async function GroupCard({ group, locale }: GroupCardProps) {
	const t = await getTranslations("groups");

	return (
		<article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30 transition hover:border-slate-700">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<p className="text-xs uppercase tracking-[0.2em] text-slate-500">
						{t("common.group")}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-lg font-semibold text-white">{group.name}</h3>
						<span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
							{group.role === "OWNER" ? t("roles.owner") : t("roles.member")}
						</span>
					</div>
					<p className="text-sm text-slate-400">
						{t("common.created", {
							date: formatCreatedAt(group.createdAt, locale),
						})}
					</p>
				</div>
				<p className="text-xs text-slate-500">
					{t("common.memberCount", { count: group.memberCount })} ·{" "}
					{t("common.privateGroup")}
				</p>
			</div>

			<div className="mt-4">
				<CopyInviteCodeButton inviteCode={group.inviteCode} showCode />
			</div>

			<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-xs leading-5 text-slate-500">
					{t("list.shareInviteOrOpen")}
				</p>
				<Link
					href={getLocalizedPath(locale, `/groups/${group.id}`)}
					className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
				>
					{t("list.openRanking")}
				</Link>
			</div>
		</article>
	);
}

export default async function GroupsPage({
	searchParams,
	params,
}: GroupsPageProps) {
	const { locale } = await params;
	const appLocale = locale as AppLocale;
	const t = await getTranslations("groups");

	const session = await auth0.getSession();

	if (!session) {
		redirect(`/auth/login?returnTo=${getLocalizedPath(appLocale, "/groups")}`);
	}

	const resolvedSearchParams = await searchParams;

	let accessToken: string;

	try {
		accessToken = (await auth0.getAccessToken()).token;
	} catch {
		redirect(`/auth/login?returnTo=${getLocalizedPath(appLocale, "/groups")}`);
	}

	const tournamentSlug = await resolveTournamentSlug();

	let tournamentId: string | null = null;
	if (tournamentSlug) {
		try {
			const tournament = await getActiveTournament(tournamentSlug);
			tournamentId = tournament.id;
		} catch {
			// Tournament not found, show all groups
		}
	}

	const [currentUserProfile, myGroups] = await Promise.all([
		getCurrentUserProfile(accessToken).catch(() => null),
		getMyGroups(accessToken, tournamentSlug).catch(() => []),
	]);

	const filteredGroups = tournamentId
		? myGroups.filter((group) => group.tournamentId === tournamentId)
		: myGroups;

	const profileComplete = currentUserProfile
		? isProfileComplete(currentUserProfile)
		: false;

	async function submitCreateGroup(formData: FormData) {
		"use server";

		const name = String(formData.get("name") ?? "").trim();

		if (!name) {
			redirect(getLocalizedPath(appLocale, "/groups?error=invalid_input"));
		}

		let actionToken: string;

		try {
			actionToken = (await auth0.getAccessToken()).token;
		} catch {
			redirect(
				`/auth/login?returnTo=${getLocalizedPath(appLocale, "/groups")}`,
			);
		}

		const tournamentSlug = await resolveTournamentSlug();

		let createdGroup: GroupView;

		try {
			createdGroup = await createGroup(actionToken, { name }, tournamentSlug);
		} catch (error) {
			redirect(
				getLocalizedPath(
					appLocale,
					`/groups?error=${getGroupActionErrorCode(error, "create")}`,
				),
			);
		}

		revalidatePath(getLocalizedPath(appLocale, "/groups"));
		redirect(getLocalizedPath(appLocale, `/groups/${createdGroup.id}`));
	}

	async function submitJoinGroup(formData: FormData) {
		"use server";

		const inviteCode = String(formData.get("inviteCode") ?? "").trim();

		if (!inviteCode) {
			redirect(getLocalizedPath(appLocale, "/groups?error=invalid_input"));
		}

		let actionToken: string;

		try {
			actionToken = (await auth0.getAccessToken()).token;
		} catch {
			redirect(
				`/auth/login?returnTo=${getLocalizedPath(appLocale, "/groups")}`,
			);
		}

		let joinedGroup: GroupView;

		try {
			joinedGroup = await joinGroup(actionToken, { inviteCode });
		} catch (error) {
			redirect(
				getLocalizedPath(
					appLocale,
					`/groups?error=${getGroupActionErrorCode(error, "join")}`,
				),
			);
		}

		revalidatePath(getLocalizedPath(appLocale, "/groups"));
		redirect(getLocalizedPath(appLocale, `/groups/${joinedGroup.id}`));
	}

	const successKey = resolvedSearchParams?.success
		? GROUP_SUCCESS_MESSAGE_KEYS[
				resolvedSearchParams.success as keyof typeof GROUP_SUCCESS_MESSAGE_KEYS
			]
		: undefined;
	const errorKey = resolvedSearchParams?.error
		? GROUP_ERROR_MESSAGE_KEYS[
				resolvedSearchParams.error as keyof typeof GROUP_ERROR_MESSAGE_KEYS
			]
		: undefined;

	return (
		<main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl">
			<section className="space-y-6 py-2 sm:py-4">
				<div className="space-y-3">
					<p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
						{t("list.eyebrow")}
					</p>
					<h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
						{t("list.title")}
					</h1>
					<p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
						{t("list.description")}
					</p>
					<p className="max-w-2xl text-sm leading-6 text-slate-500">
						{t("list.secondaryDescription")}
					</p>
				</div>

				{resolvedSearchParams?.success ? (
					<div
						role="status"
						aria-live="polite"
						className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
					>
						{successKey ? t(`success.${successKey}`) : t("success.done")}
					</div>
				) : null}

				{resolvedSearchParams?.error ? (
					<div
						role="alert"
						aria-live="assertive"
						className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
					>
						{errorKey ? t(`errors.${errorKey}`) : t("errors.unknown")}
					</div>
				) : null}

				{!profileComplete ? (
					<div className="flex flex-col gap-3 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100 shadow-xl shadow-slate-950/20 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm leading-6">{t("list.profileIncomplete")}</p>
						<Link
							href={getLocalizedPath(appLocale, "/onboarding")}
							className="inline-flex rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
						>
							{t("list.completeProfile")}
						</Link>
					</div>
				) : null}

				<GroupActionTabs
					profileComplete={profileComplete}
					submitCreateGroupAction={submitCreateGroup}
					submitJoinGroupAction={submitJoinGroup}
				/>

				<div className="space-y-4">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-slate-500">
								{t("list.myGroups")}
							</p>
							<h2 className="mt-1 text-lg font-semibold text-white">
								{t("list.yourCompetitions")}
							</h2>
						</div>
						<p className="text-sm text-slate-400">
							{t("list.groupCount", {
								filtered: filteredGroups.length,
								total: myGroups.length,
							})}
						</p>
					</div>

					{filteredGroups.length > 0 ? (
						<div className="grid gap-4">
							{filteredGroups.map((group) => (
								<GroupCard key={group.id} group={group} locale={appLocale} />
							))}
						</div>
					) : (
						<div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
							<p className="text-base font-semibold text-white">
								{t("list.noGroupsTitle")}
							</p>
							<p className="mt-2 text-slate-300">{t("list.noGroupsBody")}</p>
						</div>
					)}
				</div>
			</section>
		</main>
	);
}
