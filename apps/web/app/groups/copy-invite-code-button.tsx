"use client";

import Image from "next/image";
import { useState } from "react";

interface CopyInviteCodeButtonProps {
  inviteCode: string;
}

export function CopyInviteCodeButton({ inviteCode }: CopyInviteCodeButtonProps) {
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
      className="group relative rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-400/20"
    >
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
      <span className="sr-only" aria-live="polite">
        {copied ? "Invite code copied to clipboard" : ""}
      </span>
    </button>
  );
}
