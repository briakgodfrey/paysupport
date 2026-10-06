import { Navigate, Outlet, useLocation } from "react-router";

import type { SignInRedirectState } from "./redirect";
import { useSession } from "./SessionContext";

/**
 * Layout route that only renders its child routes for a signed-in user.
 * Anyone else is sent to sign-in, remembering where they were headed so
 * they land back there afterwards.
 *
 * This is a UX guard, not access control. Hiding a page in the browser
 * protects nothing: every request still carries the token, and the API
 * decides what that token may do.
 */
export function RequireSession() {
  const { user } = useSession();
  const location = useLocation();

  if (user === null) {
    const state: SignInRedirectState = { from: `${location.pathname}${location.search}` };
    return <Navigate to="/sign-in" replace state={state} />;
  }

  return <Outlet />;
}
