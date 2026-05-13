"use client";

import { toBlob } from "html-to-image";
import { useEffect, useState } from "react";

interface ShareActionsProps {
  title: string;
  text: string;
  url?: string;
  matchId?: string;
  captureTargetId?: string;
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

export function ShareActions({ title, text, url, matchId, captureTargetId }: ShareActionsProps) {
  const [status, setStatus] = useState<string | null>(null);
  const clipboardText = text;

  async function createShareImageBlob(): Promise<Blob | null> {
    if (!captureTargetId) {
      return null;
    }

    const element = document.getElementById(captureTargetId);

    if (!element) {
      return null;
    }

    return await toBlob(element, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "transparent",
    });
  }

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
        const imageBlob = await createShareImageBlob();

        if (imageBlob && matchId) {
          const shareFile = new File([imageBlob], `worldpredict-prediction-${matchId}.png`, {
            type: imageBlob.type || "image/png",
          });

          if (typeof navigator.canShare === "function" && navigator.canShare({ files: [shareFile] })) {
            await navigator.share({
              title,
              text,
              files: [shareFile],
            });
            setStatus("Share sheet opened");
            return;
          }
        }

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

  async function downloadImage(): Promise<void> {
    if (!matchId || !captureTargetId) {
      setStatus("No prediction selected");
      return;
    }

    setStatus("Generating image...");

    try {
      const blob = await createShareImageBlob();

      if (!blob) {
        throw new Error("Failed to generate image");
      }

      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `worldpredict-prediction-${matchId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
      setStatus("Image downloaded");
    } catch {
      setStatus("Could not generate image");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleCopyClick}
          aria-label="Copy share text"
          className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-900"
        >
          Copy
        </button>
        {matchId && (
          <button
            type="button"
            onClick={downloadImage}
            aria-label="Download share image"
            className="inline-flex flex-1 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:border-violet-500/50 hover:bg-violet-500/20"
          >
            Download PNG
          </button>
        )}
        <button
          type="button"
          onClick={shareText}
          aria-label="Open native share options"
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
