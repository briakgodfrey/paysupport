import { useCallback, useEffect, useRef, useState } from "react";

import { describeApiFailure, type FailureMessage } from "../../api/failureMessages";
import type { Discrepancy } from "../../api/schemas";
import { useSession } from "../../auth/SessionContext";

/** The discrepancy queue and how to refresh it. */
export interface UseDiscrepanciesResult {
  /** Every discrepancy (open and resolved), or null before the first successful load. */
  rows: Discrepancy[] | null;
  isLoading: boolean;
  /** Set when the latest load failed. Earlier rows stay visible underneath. */
  failure: FailureMessage | null;
  reload: () => void;
}

/**
 * Loads every discrepancy once, then filters on the client.
 *
 * The API returns the whole list with no pagination, and the open,
 * resolved, and all views plus search all come from the same rows. One
 * request keeps tab switching instant and the metrics consistent with the
 * table. If the list grows large, this should move to server-side
 * filtering and pagination.
 */
export function useDiscrepancies(): UseDiscrepanciesResult {
  const { api } = useSession();
  const [rows, setRows] = useState<Discrepancy[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failure, setFailure] = useState<FailureMessage | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const reload = useCallback(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setIsLoading(true);
    setFailure(null);

    void api.listDiscrepancies({}, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      inFlight.current = null;
      setIsLoading(false);
      if (result.ok) {
        setRows(result.data);
      } else if (result.error.kind !== "aborted") {
        setFailure(describeApiFailure(result.error));
      }
    });
  }, [api]);

  useEffect(() => {
    reload();
    return () => {
      inFlight.current?.abort();
    };
  }, [reload]);

  return { rows, isLoading, failure, reload };
}
