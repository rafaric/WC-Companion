"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

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

export function GroupActionTabs({
	profileComplete,
	submitCreateGroupAction,
	submitJoinGroupAction,
}: GroupActionTabsProps) {
	const [activeTab, setActiveTab] = useState<GroupActionTab>(
		GROUP_ACTION_TAB.CREATE,
	);
	const t = useTranslations("groups.actions");
	const tabs: Array<{ id: GroupActionTab; label: string }> = [
		{ id: GROUP_ACTION_TAB.CREATE, label: t("createTab") },
		{ id: GROUP_ACTION_TAB.JOIN, label: t("joinTab") },
	];

	return (
		<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/30 sm:p-5">
			<div
				className="grid grid-cols-2 gap-2 rounded-full border border-slate-800 bg-slate-950/60 p-1"
				role="tablist"
				aria-label={t("ariaLabel")}
			>
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
						<fieldset
							disabled={!profileComplete}
							className="disabled:opacity-60"
						>
							<div className="space-y-2">
								<p className="text-xs uppercase tracking-[0.2em] text-slate-500">
									{t("createTab")}
								</p>
								<h2 className="text-lg font-semibold text-white">
									{t("newPrivateGroup")}
								</h2>
								<p className="text-sm leading-6 text-slate-400">
									{t("createBody")}
								</p>
							</div>

							<label className="mt-5 block space-y-2">
								<span className="text-sm font-medium text-slate-200">
									{t("groupName")}
								</span>
								<input
									name="name"
									type="text"
									maxLength={80}
									placeholder={t("groupNamePlaceholder")}
									className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
									required
								/>
							</label>

							<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-xs text-slate-500">
									{t("copyAfterCreation")}
								</p>
								<button
									type="submit"
									className="rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{t("createGroup")}
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
						<fieldset
							disabled={!profileComplete}
							className="disabled:opacity-60"
						>
							<div className="space-y-2">
								<p className="text-xs uppercase tracking-[0.2em] text-slate-500">
									{t("joinTab")}
								</p>
								<h2 className="text-lg font-semibold text-white">
									{t("enterInviteCode")}
								</h2>
								<p className="text-sm leading-6 text-slate-400">
									{t("joinBody")}
								</p>
							</div>

							<label className="mt-5 block space-y-2">
								<span className="text-sm font-medium text-slate-200">
									{t("inviteCode")}
								</span>
								<input
									name="inviteCode"
									type="text"
									placeholder={t("inviteCodePlaceholder")}
									className="w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm uppercase tracking-[0.2em] text-slate-100 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-400/50"
									required
								/>
							</label>

							<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-xs text-slate-500">{t("alreadyJoined")}</p>
								<button
									type="submit"
									className="rounded-full border border-slate-700 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{t("joinGroup")}
								</button>
							</div>
						</fieldset>
					</form>
				)}
			</div>
		</section>
	);
}
