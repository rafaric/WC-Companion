"use client";

import Image from "next/image";
import { useState } from "react";

interface CopyInviteCodeButtonProps {
  inviteCode: string;
  showCode?: boolean;
}

export function CopyInviteCodeButton({ inviteCode, showCode = false }: CopyInviteCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyInviteCode() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copyInviteCode}
      aria-label={copied ? "Invite code copied" : "Copy invite code"}
      className={
        showCode
          ? "group relative flex w-full items-center justify-between gap-4 rounded-2xl border border-cyan-300/20 bg-slate-950/40 px-4 py-3 text-left text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-slate-950/60"
          : "group relative rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-400/20"
      }
    >
      {showCode ? (
        <>
          <span className="min-w-0">
            
            <span className="mt-1 block truncate font-mono text-base font-black tracking-[0.2em] text-white">
              {inviteCode}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs">
            <Image
              src="/assets/sharebutton1.png"
              alt=""
              width={16}
              height={16}
              className="object-contain opacity-80 transition group-hover:opacity-100"
            />
            {copied ? "Copied" : "Copy"}
          </span>
        </>
      ) : (
        <span className="flex items-center gap-2">
          <Image
            src="/assets/sharebutton1.png"
            alt=""
            width={16}
            height={16}
            className="object-contain opacity-80 transition group-hover:opacity-100"
          />
          {copied ? "Copied" : "Copy invite"}
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Invite code copied to clipboard" : ""}
      </span>
    </button>
  );
}
