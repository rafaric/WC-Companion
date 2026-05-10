"use client";

import { useEffect, useState } from "react";

interface ShareActionsProps {
  title: string;
  text: string;
  url?: string;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

export function ShareActions({ title, text, url }: ShareActionsProps) {
  const [status, setStatus] = useState<string | null>(null);
  const clipboardText = url ? `${text}\n${url}` : text;

  useEffect(() => {
    if (!status) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setStatus(null);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [status]);

  async function copyShareText(): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clipboardText);
        return true;
      }

      if (fallbackCopyText(clipboardText)) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  async function shareText(): Promise<void> {
    const canShare = typeof navigator !== "undefined" && "share" in navigator && typeof navigator.share === "function";

    if (canShare) {
      try {
        await navigator.share({ title, text, url });
        setStatus("Share sheet opened");
        return;
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
      }
    }

    const copied = await copyShareText();

    if (copied) {
      setStatus(canShare ? "Could not open share sheet — copied instead" : "Share unavailable — copied instead");
      return;
    }

    setStatus(canShare ? "Could not share" : "Could not copy");
  }

  async function handleCopyClick(): Promise<void> {
    const copied = await copyShareText();
    setStatus(copied ? "Copied" : "Could not copy");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleCopyClick}
          className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-900"
        >
          Copy
        </button>
        <button
          type="button"
          onClick={shareText}
          className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
        >
          Share
        </button>
      </div>
      <p className="min-h-4 text-xs leading-5 text-slate-400" aria-live="polite">
        {status ?? " "}
      </p>
    </div>
  );
}
