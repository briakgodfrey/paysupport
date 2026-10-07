import { useEffect, useState } from "react";

import "./CopyButton.css";

/** Props for {@link CopyButton}. */
export interface CopyButtonProps {
  /** The exact text to put on the clipboard. */
  value: string;
  /** What is being copied, e.g. "transaction ID". Completes the accessible name "Copy transaction ID". */
  label: string;
}

type CopyState = "idle" | "copied" | "failed";

/** How long "Copied" stays visible before the button resets. Long enough to notice, short enough to copy again. */
const RESET_AFTER_MS = 2000;

/**
 * Copies a value (usually an ID) with one click.
 *
 * Engineers paste IDs into tickets, chat, and SQL all day. Selecting a
 * 36-character UUID by hand is slow and error-prone, and a dropped
 * character sends someone else investigating the wrong payment.
 *
 * Feedback is both visible ("Copied") and announced through a polite live
 * region. If the clipboard is unavailable (an insecure context, or a
 * browser permission denial), the user is told to copy it manually rather
 * than left assuming it worked.
 */
export function CopyButton({ value, label }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => {
      setState("idle");
    }, RESET_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  const visibleText = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy";
  const announcement =
    state === "copied"
      ? `Copied ${label}.`
      : state === "failed"
        ? `Couldn’t copy the ${label}. Select the text and copy it manually.`
        : "";

  return (
    <span className="copy-button">
      <button
        type="button"
        className="copy-button__button"
        data-state={state}
        onClick={() => {
          void copy();
        }}
      >
        {visibleText} <span className="visually-hidden">{label}</span>
      </button>
      <span className="visually-hidden" role="status">
        {announcement}
      </span>
    </span>
  );
}
