import { useCallback, useEffect, useRef, useState } from "react";

import { getHealth } from "../api/endpoints";

/** What the UI knows about the API connection. */
export type ApiHealthStatus = "checking" | "connected" | "unavailable";

/** Current API health plus a way to re-check on demand. */
export interface ApiHealth {
  /** "checking" only before the first result; later checks keep the last known status to avoid flicker. */
  status: ApiHealthStatus;
  /** True while any check is in flight, including re-checks. */
  isChecking: boolean;
  /** When the most recent check finished, or null before the first one. */
  lastCheckedAt: Date | null;
  /** Runs a check immediately, e.g. from a "Check now" button. */
  checkNow: () => void;
}

/**
 * Often enough that an engineer learns about an outage before they try to
 * diagnose and hit an error, rare enough to be negligible load on the API.
 */
export const HEALTH_POLL_INTERVAL_MS = 30_000;

/** A health check should be near-instant. Five seconds without an answer is effectively down for the user. */
const HEALTH_TIMEOUT_MS = 5_000;

/**
 * Polls GET /health and reports whether the API is reachable.
 *
 * Polling pauses while the tab is hidden (no point checking for a tab no
 * one is looking at) and re-checks as soon as it becomes visible again, so
 * an engineer returning to the tab sees a fresh status.
 *
 * @param pollIntervalMs - How often to re-check while the tab is visible.
 */
export function useApiHealth(pollIntervalMs = HEALTH_POLL_INTERVAL_MS): ApiHealth {
  const [status, setStatus] = useState<ApiHealthStatus>("checking");
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const cancelInFlight = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
  }, []);

  const check = useCallback(async () => {
    // Only the newest check may update state. Without this, a slow
    // response from an older check could overwrite a newer result.
    cancelInFlight();
    const controller = new AbortController();
    inFlight.current = controller;
    setIsChecking(true);

    const result = await getHealth({ signal: controller.signal, timeoutMs: HEALTH_TIMEOUT_MS });
    if (controller.signal.aborted) return;

    inFlight.current = null;
    setIsChecking(false);
    setStatus(result.ok ? "connected" : "unavailable");
    setLastCheckedAt(new Date());
  }, [cancelInFlight]);

  useEffect(() => {
    void check();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, pollIntervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelInFlight();
    };
  }, [check, cancelInFlight, pollIntervalMs]);

  const checkNow = useCallback(() => {
    void check();
  }, [check]);

  return { status, isChecking, lastCheckedAt, checkNow };
}
