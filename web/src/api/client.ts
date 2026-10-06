import type { z } from "zod";

/**
 * Why a request failed, in terms the UI can act on. Callers switch on
 * `kind` instead of inspecting raw responses, so every failure mode has to
 * be handled explicitly. Piece 2 adds auth and API error kinds.
 */
export type ApiFailure =
  /** The request never got a response: API down, DNS, or the user is offline. */
  | { kind: "network" }
  /** No response within the timeout. Reported separately because the fix (wait and retry) differs. */
  | { kind: "timeout" }
  /** The caller cancelled the request (unmount, or a newer request replaced it). Not shown to users. */
  | { kind: "aborted" }
  /** The API responded with a non-2xx status. */
  | { kind: "http"; status: number }
  /** The API responded with 2xx, but the body wasn't JSON or didn't match the expected schema. */
  | { kind: "invalid_response" };

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

/**
 * GETs `path` and validates the JSON body against `schema`.
 *
 * The response is treated as untrusted input: it is parsed as `unknown`
 * and only returned once Zod has checked its shape, so a buggy or
 * compromised API can't hand the UI data its types don't describe.
 *
 * @param path - API path starting with "/", with any dynamic segments already encoded.
 * @param schema - Zod schema the response body must match.
 * @param options - Timeout and cancellation.
 * @returns The validated data, or a typed failure. Never throws for network or API errors.
 */
export async function getJson<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<ApiResult<z.output<S>>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;

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
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch {
      return { ok: false, error: interruptedFailure() ?? { kind: "network" } };
    }

    if (!response.ok) {
      return { ok: false, error: { kind: "http", status: response.status } };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, error: interruptedFailure() ?? { kind: "invalid_response" } };
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: { kind: "invalid_response" } };
    }
    return { ok: true, data: parsed.data };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
