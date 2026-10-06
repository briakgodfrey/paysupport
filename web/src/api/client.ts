import type { z } from "zod";

import { apiErrorBodySchema, type ApiErrorBody } from "./schemas";

/**
 * Why a request failed, in terms the UI can act on. Callers switch on
 * `kind` instead of inspecting raw responses, so every failure mode has to
 * be handled explicitly.
 *
 * `detail` carries the API's own `{ error, message }` body when it sent a
 * valid one. It is untrusted text: render it as plain text, and prefer the
 * UI's own copy (see failureMessages.ts) for the main message.
 */
export type ApiFailure =
  /** The request never got a response: API down, DNS, or the user is offline. */
  | { kind: "network" }
  /** No response within the timeout. Reported separately because the fix (wait and retry) differs. */
  | { kind: "timeout" }
  /** The caller cancelled the request (unmount, or a newer request replaced it). Never shown to users. */
  | { kind: "aborted" }
  /** 401: the token is missing, expired, or invalid, or sign-in credentials were wrong. */
  | { kind: "unauthorized"; detail: ApiErrorBody | null }
  /** 403: signed in, but this role may not do this. */
  | { kind: "forbidden"; detail: ApiErrorBody | null }
  /** 404: no such resource, e.g. an unknown transaction ID. */
  | { kind: "not_found"; detail: ApiErrorBody | null }
  /** 400: the API rejected the request body or parameters. */
  | { kind: "validation"; detail: ApiErrorBody | null }
  /** 5xx: the API or something in front of it (like the dev proxy's 502) failed. */
  | { kind: "server"; status: number; detail: ApiErrorBody | null }
  /** Any other non-2xx status. Unexpected for this API, but handled rather than assumed away. */
  | { kind: "unexpected_status"; status: number; detail: ApiErrorBody | null }
  /** 2xx, but the body wasn't JSON or didn't match the expected schema. */
  | { kind: "invalid_response" };

/** Failures worth showing to a user. Handle `aborted` first (usually by ignoring it). */
export type VisibleApiFailure = Exclude<ApiFailure, { kind: "aborted" }>;

/**
 * The outcome of an API call. The client never throws for expected
 * failures, so components can't forget a try/catch and leave the user
 * looking at a spinner forever.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

/** Per-request options shared by every endpoint function. */
export interface RequestOptions {
  /** Abort after this many milliseconds and report `timeout`. */
  timeoutMs?: number;
  /** Lets the caller cancel, for example when a component unmounts. */
  signal?: AbortSignal;
}

/** Everything needed to make one request. */
export interface ApiRequest<S extends z.ZodType> extends RequestOptions {
  method: "GET" | "POST";
  /** Starts with "/". Dynamic segments must already be encoded with encodeURIComponent. */
  path: string;
  /** The response body must match this schema, or the result is `invalid_response`. */
  schema: S;
  /** Serialised as JSON. Omit for requests without a body. */
  body?: unknown;
}

/** How a client finds the current session and reports that it has ended. */
export interface ApiClientConfig {
  /**
   * Returns the current bearer token, or null when signed out. Read on
   * every request, so a client created once keeps working after sign-in.
   */
  getToken?: () => string | null;
  /**
   * Called when a request that carried a token gets a 401, meaning the
   * session expired or was revoked. The session owner clears it and sends
   * the user back to sign-in.
   *
   * Receives the token that was rejected, so the owner can ignore a late
   * 401 from a previous session instead of signing out the current one.
   */
  onUnauthorized?: (rejectedToken: string) => void;
}

/** Sends validated, typed requests. Create one with {@link createApiClient}. */
export interface ApiClient {
  request<S extends z.ZodType>(request: ApiRequest<S>): Promise<ApiResult<z.output<S>>>;
}

/** Long enough for a slow vendor lookup, short enough that a hung API doesn't trap the user. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * "/api" in development (the Vite proxy) and, by default, in production
 * behind a same-origin reverse proxy. The value is public config, not a
 * secret: it ships in the bundle.
 */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured === undefined || configured.trim() === "") return "/api";
  return configured.replace(/\/+$/, "");
}

const API_BASE_URL = resolveApiBaseUrl();

/**
 * Resolving against the page origin turns "/api/health" into an absolute
 * URL. Browsers accept relative URLs, but Node's fetch (used by the test
 * environment) does not.
 */
function buildUrl(path: string): string {
  return new URL(`${API_BASE_URL}${path}`, window.location.origin).toString();
}

function failureForStatus(status: number, detail: ApiErrorBody | null): VisibleApiFailure {
  if (status === 400) return { kind: "validation", detail };
  if (status === 401) return { kind: "unauthorized", detail };
  if (status === 403) return { kind: "forbidden", detail };
  if (status === 404) return { kind: "not_found", detail };
  if (status >= 500) return { kind: "server", status, detail };
  return { kind: "unexpected_status", status, detail };
}

/**
 * Error bodies are optional extras. A proxy's HTML error page or an empty
 * body must not turn a clear "server error" into a confusing parse error,
 * so anything unreadable becomes null.
 */
async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const body: unknown = await response.json();
    const parsed = apiErrorBodySchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function sendRequest<S extends z.ZodType>(
  request: ApiRequest<S>,
  config: ApiClientConfig,
): Promise<ApiResult<z.output<S>>> {
  const { method, path, schema, body, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = request;

  const token = config.getToken?.() ?? null;
  const headers = new Headers({ Accept: "application/json" });
  if (token !== null) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  // One internal controller handles both the timeout and the caller's
  // cancellation, so fetch only has to watch a single signal.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => {
    controller.abort();
  };
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  // Classifies a thrown error once we know the request was cut short.
  const interruptedFailure = (): ApiFailure | null => {
    if (timedOut) return { kind: "timeout" };
    if (controller.signal.aborted) return { kind: "aborted" };
    return null;
  };

  // The timer stays armed until the body has been read, so a server that
  // sends headers and then stalls still hits the timeout.
  try {
    let response: Response;
    try {
      response = await fetch(buildUrl(path), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        // Responses include customer names and emails. Support machines
        // are often shared, so nothing is written to the browser's HTTP
        // cache where a later user or local malware could read it.
        cache: "no-store",
        // Auth is a bearer header, not cookies. Omitting cookies means a
        // stray cookie for this origin is never sent, and there is no
        // ambient credential for a CSRF attack to ride on. Switching to
        // httpOnly cookie auth would change this to "same-origin".
        credentials: "omit",
      });
    } catch {
      return { ok: false, error: interruptedFailure() ?? { kind: "network" } };
    }

    if (!response.ok) {
      const detail = await readErrorBody(response);
      // Only a request that carried a token can mean "your session ended".
      // A 401 from the sign-in form just means wrong credentials.
      if (response.status === 401 && token !== null) config.onUnauthorized?.(token);
      return { ok: false, error: failureForStatus(response.status, detail) };
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      return { ok: false, error: interruptedFailure() ?? { kind: "invalid_response" } };
    }

    // The response is untrusted input: it is parsed as `unknown` and only
    // returned once Zod has checked its shape, so a buggy or compromised
    // API can't hand the UI data its types don't describe.
    const parsed = schema.safeParse(responseBody);
    if (!parsed.success) {
      return { ok: false, error: { kind: "invalid_response" } };
    }
    return { ok: true, data: parsed.data };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

/**
 * Creates the one module allowed to call fetch. It owns the base URL,
 * the auth header, timeouts, JSON handling, response validation, and
 * mapping every failure to a typed {@link ApiFailure}.
 *
 * @param config - Where to read the session token and what to do when it expires. Omit for unauthenticated calls.
 * @returns A client whose `request` never throws for network or API errors.
 */
export function createApiClient(config: ApiClientConfig = {}): ApiClient {
  return {
    request(request) {
      return sendRequest(request, config);
    },
  };
}
