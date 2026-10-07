import { useCallback, useEffect, useState } from "react";

import type { VisibleApiFailure } from "../../api/client";
import type { DiagnosisReport } from "../../api/schemas";
import { useSession } from "../../auth/SessionContext";

/** Where a diagnosis request is. Each state maps to one thing on screen. */
export type DiagnosisState =
  | { status: "loading" }
  | { status: "success"; report: DiagnosisReport }
  | { status: "failure"; failure: VisibleApiFailure };

/** The current diagnosis plus a way to run it again. */
export interface UseDiagnosisResult {
  state: DiagnosisState;
  /** Re-runs the diagnosis, e.g. after "Processor unavailable" or a network error. */
  retry: () => void;
}

/**
 * Diagnoses one transaction, re-running whenever the ID changes.
 *
 * Every call writes an audit-log entry on the server, so this only runs
 * when the ID changes or the user asks to retry. It never polls.
 *
 * In development, React StrictMode mounts the page twice, which sends a
 * second request (and audit entry) before the first is cancelled.
 * Production builds don't do this.
 *
 * @param transactionId - An already validated, normalized transaction ID.
 */
export function useDiagnosis(transactionId: string): UseDiagnosisResult {
  const { api } = useSession();
  const [state, setState] = useState<DiagnosisState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    // A new ID or a retry starts fresh, so a stale result is never shown under a new heading.
    setState({ status: "loading" });

    void api.diagnoseTransaction(transactionId, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        setState({ status: "success", report: result.data });
      } else if (result.error.kind !== "aborted") {
        setState({ status: "failure", failure: result.error });
      }
    });

    return () => {
      controller.abort();
    };
  }, [api, transactionId, attempt]);

  const retry = useCallback(() => {
    setAttempt((count) => count + 1);
  }, []);

  return { state, retry };
}
