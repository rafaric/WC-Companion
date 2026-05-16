import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export const metadata = buildPageMetadata({
  title: "Groups",
  description: "Create or join private football prediction groups and compete with your friends.",
  index: false,
  path: "/groups",
});

type GroupsSearchParams = {
  error?: string;
  success?: string;
};

interface GroupsPageProps {
  searchParams?: Promise<GroupsSearchParams>;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Use a short group name and a valid invite code.",
  not_found: "We could not find that invite code or group.",
  session_expired: "Your session expired. Sign in again to manage groups.",
  create_failed: "We could not create the group right now. Try again.",
  join_failed: "We could not join the group right now. Try again.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  created: "Group created successfully.",
  joined: "You joined the group.",
};

function formatCreatedAt(createdAt: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

function getGroupActionErrorCode(error: unknown, action: "create" | "join"): string {
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

function getGroupRoleLabel(role: MyGroupView["role"]): string {
  return role === "OWNER" ? "Owner" : "Member";
}

function formatMemberCount(memberCount: number): string {
  return `${memberCount} ${memberCount === 1 ? "member" : "members"}`;
}

function GroupCard({ group }: { group: MyGroupView }) {
  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30 transition hover:border-slate-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Group</p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{group.name}</h3>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
              {getGroupRoleLabel(group.role)}
            </span>
          </div>
          <p className="text-sm text-slate-400">Created {formatCreatedAt(group.createdAt)}</p>
        </div>
        <p className="text-xs text-slate-500">{formatMemberCount(group.memberCount)} · private group</p>
      </div>

      <div className="mt-4">
        <CopyInviteCodeButton inviteCode={group.inviteCode} showCode />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">Share the invite code or open the private ranking.</p>
        <Link
          href={`/groups/${group.id}`}
          className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
        >
          Open ranking
        </Link>
      </div>
    </article>
  );
}

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login?returnTo=/groups");
  }

  const resolvedSearchParams = await searchParams;

  let accessToken: string;

  try {
    accessToken = (await auth0.getAccessToken()).token;
  } catch {
    redirect("/auth/login?returnTo=/groups");
  }

  const tournamentSlug = await resolveTournamentSlug();

  // Get tournament ID from slug for proper comparison (group.tournamentId is UUID, not slug)
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

  // Filter groups by selected tournament when one is chosen
  const filteredGroups = tournamentId
    ? myGroups.filter((group) => group.tournamentId === tournamentId)
    : myGroups;

  const profileComplete = currentUserProfile ? isProfileComplete(currentUserProfile) : false;

  async function submitCreateGroup(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();

    if (!name) {
      redirect("/groups?error=invalid_input");
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/groups");
    }

    // Get selected tournament context for the new group
    const tournamentSlug = await resolveTournamentSlug();

    let createdGroup: GroupView;

    try {
      createdGroup = await createGroup(actionToken, { name }, tournamentSlug);
    } catch (error) {
      redirect(`/groups?error=${getGroupActionErrorCode(error, "create")}`);
    }

    revalidatePath("/groups");
    redirect(`/groups/${createdGroup.id}`);
  }

  async function submitJoinGroup(formData: FormData) {
    "use server";

    const inviteCode = String(formData.get("inviteCode") ?? "").trim();

    if (!inviteCode) {
      redirect("/groups?error=invalid_input");
    }

    let actionToken: string;

    try {
      actionToken = (await auth0.getAccessToken()).token;
    } catch {
      redirect("/auth/login?returnTo=/groups");
    }

    let joinedGroup: GroupView;

    try {
      joinedGroup = await joinGroup(actionToken, { inviteCode });
    } catch (error) {
      redirect(`/groups?error=${getGroupActionErrorCode(error, "join")}`);
    }

    revalidatePath("/groups");
    redirect(`/groups/${joinedGroup.id}`);
  }

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl">
      <section className="space-y-6 py-2 sm:py-4">
          <div className="space-y-3">
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              Social groups
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Compete with your private circle.</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Create a group, copy the invite code, and bring your friends into your private circle.
            </p>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Open each group to see the ranking, latest scored players, and your position after results land.
            </p>
          </div>

          {resolvedSearchParams?.success ? (
            <div role="status" aria-live="polite" className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {SUCCESS_MESSAGES[resolvedSearchParams.success] ?? "Done."}
            </div>
          ) : null}

          {resolvedSearchParams?.error ? (
            <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {ERROR_MESSAGES[resolvedSearchParams.error] ?? "Something went wrong. Please try again."}
            </div>
          ) : null}

          {!profileComplete ? (
            <div className="flex flex-col gap-3 rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-amber-100 shadow-xl shadow-slate-950/20 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6">
                Finish onboarding first. Group actions stay visible, but disabled until your profile is complete.
              </p>
              <Link
                href="/onboarding"
                className="inline-flex rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Complete profile
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
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">My groups</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Your competitions</h2>
              </div>
              <p className="text-sm text-slate-400">
                {filteredGroups.length}
                {tournamentSlug ? ` of ${myGroups.length}` : ` of ${myGroups.length}`}
              </p>
            </div>

            {filteredGroups.length > 0 ? (
              <div className="grid gap-4">
                {filteredGroups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
                <p className="text-base font-semibold text-white">No groups yet.</p>
                <p className="mt-2 text-slate-300">
                  Create one above to get your first invite code, or join a friend’s group to start together.
                </p>
              </div>
            )}
          </div>
      </section>
    </main>
  );
}
