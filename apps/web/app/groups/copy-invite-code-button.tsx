"use client";

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
      className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-400/20"
    >
      {copied ? "Copied" : "Copy invite"}
    </button>
  );
}
