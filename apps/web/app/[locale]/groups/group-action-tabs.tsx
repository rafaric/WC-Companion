"use client";

import { useState } from "react";

const GROUP_ACTION_TAB = {
  CREATE: "create",
  JOIN: "join",
} as const;

type GroupActionTab = (typeof GROUP_ACTION_TAB)[keyof typeof GROUP_ACTION_TAB];

interface GroupActionTabsProps {
  profileComplete: boolean;
  submitCreateGroupAction: (formData: FormData) => Promise<void>;
  submitJoinGroupAction: (formData: FormData) => Promise<void>;
}

const tabs: Array<{ id: GroupActionTab; label: string; description: string }> = [
  {
    id: GROUP_ACTION_TAB.CREATE,
    label: "Create",
    description: "Start a new private group and invite your crew.",
  },
  {
    id: GROUP_ACTION_TAB.JOIN,
    label: "Join",
    description: "Use an invite code from a friend.",
  },
];

export function GroupActionTabs({
  profileComplete,
  submitCreateGroupAction,
  submitJoinGroupAction,
}: GroupActionTabsProps) {
  const [activeTab, setActiveTab] = useState<GroupActionTab>(GROUP_ACTION_TAB.CREATE);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30 sm:p-5">
      <div className="grid grid-cols-2 gap-2 rounded-full border border-slate-800 bg-slate-950/60 p-1" role="tablist" aria-label="Group actions">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`group-action-${tab.id}`}
              id={`group-action-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                selected
                  ? "bg-cyan-400/15 text-cyan-100 shadow-lg shadow-cyan-950/20"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {activeTab === GROUP_ACTION_TAB.CREATE ? (
          <form
            action={submitCreateGroupAction}
            role="tabpanel"
            id="group-action-create"
            aria-labelledby="group-action-tab-create"
          >
            <fieldset disabled={!profileComplete} className="disabled:opacity-60">
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

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        ) : (
          <form
            action={submitJoinGroupAction}
            role="tabpanel"
            id="group-action-join"
            aria-labelledby="group-action-tab-join"
          >
            <fieldset disabled={!profileComplete} className="disabled:opacity-60">
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

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        )}
      </div>
    </section>
  );
}
