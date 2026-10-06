import type { VisibleApiFailure } from "./client";

/** Plain-language copy for a failed request: what happened, then what the user can do. */
export interface FailureMessage {
  /** One short sentence saying what went wrong, in the user's terms. */
  title: string;
  /** The next step the user can take. Never empty: every error offers a way forward. */
  action: string;
}

/**
 * Default user-facing copy for each failure kind.
 *
 * Screens can override this when they know more context (a 404 on the
 * diagnose screen is "no transaction with that ID"), but every screen
 * starts from copy that says what happened and what to do, never just
 * "Something went wrong". The API's own `detail.message` is deliberately
 * not used here: it is written for developers ("Requires role: engineer
 * or admin") and is untrusted text.
 *
 * Takes {@link VisibleApiFailure} so callers must handle `aborted` (a
 * cancelled request the user never needs to hear about) before asking
 * for copy.
 *
 * @param failure - The failure to describe.
 */
export function describeApiFailure(failure: VisibleApiFailure): FailureMessage {
  switch (failure.kind) {
    case "network":
      return {
        title: "Can’t reach the PaySupport API.",
        action: "Check your connection, wait for the status in the header to show connected, then try again.",
      };
    case "timeout":
      return {
        title: "The API took too long to respond.",
        action: "Try again. If it keeps happening, the API or the payment processor may be overloaded.",
      };
    case "unauthorized":
      return {
        title: "Your session has ended.",
        action: "Sign in again to continue.",
      };
    case "forbidden":
      return {
        title: "You don’t have access to this.",
        action: "Ask an admin if your role needs this permission.",
      };
    case "not_found":
      return {
        title: "We couldn’t find that.",
        action: "Check the ID and try again.",
      };
    case "validation":
      return {
        title: "The API couldn’t accept that request.",
        action: "Check what you entered and try again.",
      };
    case "server":
      return {
        title: "The API ran into a problem.",
        action: "Try again in a moment. If it keeps happening, report it to the engineering on-call.",
      };
    case "unexpected_status":
      return {
        title: "The API sent an unexpected response.",
        action: "Try again. If it keeps happening, report it to the engineering on-call.",
      };
    case "invalid_response":
      return {
        title: "The API sent data the dashboard couldn’t read.",
        action: "This usually means the dashboard and API versions don’t match. Report it to engineering.",
      };
  }
}
