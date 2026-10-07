import { useCallback, useEffect, useRef, useState } from "react";

import type { VisibleApiFailure } from "../../api/client";
import type { ReconciliationSummary } from "../../api/schemas";
import { useSession } from "../../auth/SessionContext";

/** Where the sweep is. Each state maps to one message on screen. */
export type SweepState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; summary: ReconciliationSummary; finishedAt: Date }
  | { status: "failed"; failure: VisibleApiFailure };

/** The sweep's state and how to start it. */
export interface UseReconciliationSweepResult {
  state: SweepState;
  /** Starts a sweep. Ignored while one is already running. */
  run: () => void;
}

/**
 * Runs a reconciliation sweep (POST /reconciliation/run).
 *
 * Results live in memory for this session only: the API has no "last
 * sweep" endpoint, so the metric resets on reload.
 *
 * @param onComplete - Called after a successful sweep, to refresh the queue it just updated.
 */
export function useReconciliationSweep(onComplete: () => void): UseReconciliationSweepResult {
  const { api } = useSession();
  const [state, setState] = useState<SweepState>({ status: "idle" });
  const inFlight = useRef<AbortController | null>(null);
  // Keep the latest callback without re-creating `run` whenever the parent re-renders.
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Cancel a running sweep's request if the user leaves the page. The
  // server keeps going either way; this just stops a stale state update.
  useEffect(
    () => () => {
      inFlight.current?.abort();
    },
    [],
  );

  const run = useCallback(() => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ status: "running" });

    void api.runReconciliation({ signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      inFlight.current = null;
      if (result.ok) {
        setState({ status: "done", summary: result.data, finishedAt: new Date() });
        onCompleteRef.current();
      } else if (result.error.kind !== "aborted") {
        setState({ status: "failed", failure: result.error });
      }
    });
  }, [api]);

  return { state, run };
}
