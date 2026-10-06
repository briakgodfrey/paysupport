/*
 * Where to send a user after they sign in. Kept separate from the page so
 * the safety rules can be unit tested on their own.
 */

/** Router location state set by RequireSession when it redirects to sign-in. */
export interface SignInRedirectState {
  from?: string;
}

/**
 * Returns the in-app path the user was trying to reach, or "/" if there
 * isn't a safe one.
 *
 * Only same-app paths are allowed: they must start with a single "/".
 * "//evil.example" is a protocol-relative URL to another site, and
 * "https://..." is absolute, so both are rejected. Router state can't be
 * set by an outside link today, but checking here means a future
 * "?returnTo=" parameter can't turn sign-in into an open redirect that
 * sends someone to a phishing page right after they authenticate.
 *
 * The sign-in page itself is rejected too, to avoid a redirect loop.
 *
 * @param state - The router location state, which is untyped (`unknown`) at runtime.
 */
export function safeRedirectPath(state: unknown): string {
  if (typeof state !== "object" || state === null || !("from" in state)) return "/";
  const { from } = state;
  if (typeof from !== "string") return "/";
  if (!from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return "/";
  if (from === "/sign-in" || from.startsWith("/sign-in?")) return "/";
  return from;
}
