import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import {
  ApiError,
  createGroup,
  getCurrentUserProfile,
  getMyGroups,
  joinGroup,
  type CurrentUserProfile,
  type GroupView,
  type MyGroupView,
} from "@/lib/api";
import { formatCountryLabel, isProfileComplete } from "@/lib/profile";
import { CopyInviteCodeButton } from "./copy-invite-code-button";

type GroupsSearchParams = {
  error?: string;
  success?: string;
};

interface GroupsPageProps {
  searchParams?: Promise<GroupsSearchParams>;
}

type Session = NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>;

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

function getDisplayName(user: Session["user"]): string {
  return user.name ?? user.nickname ?? user.email ?? user.sub;
}

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

function renderProfileNote(profile: CurrentUserProfile | null): string {
  if (!profile) {
    return "We could not load your backend profile right now.";
  }

  const countryLabel = formatCountryLabel(profile.country);

  return `Signed in as ${profile.username} · ${countryLabel}`;
}

function GroupCard({ group }: { group: MyGroupView }) {
  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30 transition hover:border-slate-700">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Group</p>
          <h3 className="text-lg font-semibold text-white">{group.name}</h3>
          <p className="text-sm text-slate-400">Created {formatCreatedAt(group.createdAt)}</p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
          {getGroupRoleLabel(group.role)}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Invite code</p>
            <p className="mt-1 break-all text-2xl font-black tracking-[0.15em] text-white">{group.inviteCode}</p>
          </div>
          <CopyInviteCodeButton inviteCode={group.inviteCode} />
        </div>
        <p className="mt-3 text-xs leading-5 text-cyan-100/70">
          Send this code to friends so they can join from the Groups page.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Use this group to compete privately during the tournament.</p>
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

  const [currentUserProfile, myGroups] = await Promise.all([
    getCurrentUserProfile(accessToken).catch(() => null),
    getMyGroups(accessToken).catch(() => []),
  ]);

  const profileComplete = currentUserProfile ? isProfileComplete(currentUserProfile) : false;
  const displayName = currentUserProfile?.username ?? getDisplayName(session.user);

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

    let createdGroup: GroupView;

    try {
      createdGroup = await createGroup(actionToken, { name });
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
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="worldpredict-aurora absolute inset-0 -z-10" />

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 rounded-full border border-slate-800/80 bg-slate-900/60 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">WorldPredict</p>
            <p className="text-xs text-slate-400">Private groups</p>
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
              href="/share"
              className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
            >
              Share cards
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
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">
              Social groups
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Compete with your private circle.</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Create a group, copy the invite code, and bring your friends into the ranking fight.
            </p>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Open each group to see the podium, latest scored players, and your position after results land.
            </p>
          </div>

          {resolvedSearchParams?.success ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              {SUCCESS_MESSAGES[resolvedSearchParams.success] ?? "Done."}
            </div>
          ) : null}

          {resolvedSearchParams?.error ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              {ERROR_MESSAGES[resolvedSearchParams.error] ?? "Something went wrong. Please try again."}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/30">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Profile</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{renderProfileNote(currentUserProfile)}</p>
            {!profileComplete ? (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-amber-100">
                  Finish onboarding first. We keep group actions visible, but disabled until your profile is complete.
                </p>
                <Link
                  href="/onboarding"
                  className="inline-flex rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
                >
                  Complete profile
                </Link>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <form action={submitCreateGroup}>
              <fieldset
                disabled={!profileComplete}
                className="h-full rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30 disabled:opacity-60"
              >
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Create</p>
                  <h2 className="text-lg font-semibold text-white">New private group</h2>
                  <p className="text-sm leading-6 text-slate-400">Pick a name, get an invite code, and start your crew ranking.</p>
                </div>

                <label className="mt-5 block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Group name</span>
                  <input
                    name="name"
                    type="text"
                    maxLength={80}
                    placeholder="Los Pibes del Mundial"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                    required
                  />
                </label>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">You can copy the invite code after creation.</p>
                  <button
                    type="submit"
                    className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Create group
                  </button>
                </div>
              </fieldset>
            </form>

            <form action={submitJoinGroup}>
              <fieldset
                disabled={!profileComplete}
                className="h-full rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30 disabled:opacity-60"
              >
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Join</p>
                  <h2 className="text-lg font-semibold text-white">Enter an invite code</h2>
                  <p className="text-sm leading-6 text-slate-400">Paste the code from a friend and jump into their private leaderboard.</p>
                </div>

                <label className="mt-5 block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Invite code</span>
                  <input
                    name="inviteCode"
                    type="text"
                    placeholder="ABC123XYZ"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.2em] text-slate-100 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-400/50"
                    required
                  />
                </label>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Already joined? Opening the ranking is enough.</p>
                  <button
                    type="submit"
                    className="rounded-full border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Join group
                  </button>
                </div>
              </fieldset>
            </form>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">My groups</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Your competitions</h2>
              </div>
              <p className="text-sm text-slate-400">{myGroups.length} total</p>
            </div>

            {myGroups.length > 0 ? (
              <div className="grid gap-4">
                {myGroups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm leading-6 text-slate-300">
                No groups yet. Create one to get an invite code, or join a friend’s group to start competing.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
