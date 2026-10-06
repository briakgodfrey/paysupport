import { createApiClient, type ApiClientConfig, type ApiResult, type RequestOptions } from "./client";
import {
  diagnosisReportSchema,
  discrepancyListSchema,
  healthSchema,
  loginResponseSchema,
  reconciliationSummarySchema,
  type DiagnosisReport,
  type Discrepancy,
  type Health,
  type LoginResponse,
  type ReconciliationSummary,
} from "./schemas";

/*
 * One typed function per API endpoint. Components and hooks call these
 * and never build URLs themselves, which keeps path encoding and schema
 * choice in one reviewable place.
 */

/**
 * A sweep diagnoses transactions one at a time, and each vendor lookup
 * can take up to 3s with one retry (src/services/vendor.client.ts). The
 * default 10s timeout would cut off a healthy sweep. If even this runs
 * out, the sweep may still finish on the server; re-running is safe
 * because the API skips discrepancies that are already open.
 */
export const RECONCILIATION_TIMEOUT_MS = 120_000;

/** Sign-in credentials. Sent only in the POST body, never in a URL where they would end up in logs and history. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** Filter for the discrepancy list. Omit `resolved` to list everything. */
export interface DiscrepancyFilter {
  resolved?: boolean;
}

/** Every PaySupport endpoint the dashboard uses. */
export interface PaySupportApi {
  /** GET /health. Only proves the API process is answering, not the database or vendor. */
  getHealth(options?: RequestOptions): Promise<ApiResult<Health>>;
  /** POST /auth/login. A 401 here means wrong credentials, not an expired session. */
  login(credentials: LoginCredentials, options?: RequestOptions): Promise<ApiResult<LoginResponse>>;
  /** GET /transactions/:id/diagnose. Each call also writes an audit-log entry, so don't poll it. */
  diagnoseTransaction(transactionId: string, options?: RequestOptions): Promise<ApiResult<DiagnosisReport>>;
  /** POST /reconciliation/run. Engineer and admin only; other roles get `forbidden`. */
  runReconciliation(options?: RequestOptions): Promise<ApiResult<ReconciliationSummary>>;
  /** GET /reconciliation/discrepancies. Available to every signed-in role. */
  listDiscrepancies(filter?: DiscrepancyFilter, options?: RequestOptions): Promise<ApiResult<Discrepancy[]>>;
}

/**
 * Builds the typed API surface on top of a client.
 *
 * @param config - Token source and session-expiry callback. The session provider passes these once signed in.
 */
export function createPaySupportApi(config?: ApiClientConfig): PaySupportApi {
  const client = createApiClient(config);

  return {
    getHealth(options) {
      return client.request({ method: "GET", path: "/health", schema: healthSchema, ...options });
    },

    login(credentials, options) {
      return client.request({
        method: "POST",
        path: "/auth/login",
        schema: loginResponseSchema,
        body: { email: credentials.email, password: credentials.password },
        ...options,
      });
    },

    diagnoseTransaction(transactionId, options) {
      // Encoding stops a crafted ID like "../accounts" or "x?admin=1" from
      // changing which endpoint is called. The API still validates the ID;
      // this only guarantees it stays a single path segment.
      const path = `/transactions/${encodeURIComponent(transactionId)}/diagnose`;
      return client.request({ method: "GET", path, schema: diagnosisReportSchema, ...options });
    },

    runReconciliation(options) {
      return client.request({
        method: "POST",
        path: "/reconciliation/run",
        schema: reconciliationSummarySchema,
        timeoutMs: RECONCILIATION_TIMEOUT_MS,
        ...options,
      });
    },

    listDiscrepancies(filter = {}, options) {
      const query = new URLSearchParams();
      if (filter.resolved !== undefined) query.set("resolved", String(filter.resolved));
      const queryString = query.toString();
      const search = queryString === "" ? "" : `?${queryString}`;
      return client.request({
        method: "GET",
        path: `/reconciliation/discrepancies${search}`,
        schema: discrepancyListSchema,
        ...options,
      });
    },
  };
}

/**
 * Unauthenticated API for the calls that happen before sign-in (health and
 * login). It never sends a token, so a 401 from it can't end a session.
 */
export const publicApi = createPaySupportApi();
