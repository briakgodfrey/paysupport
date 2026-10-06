import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import type { ApiResult, RequestOptions } from "../api/client";
import { createPaySupportApi, publicApi, type LoginCredentials, type PaySupportApi } from "../api/endpoints";
import type { AuthUser } from "../api/schemas";

/** Why the last session ended, so sign-in can explain what happened. */
export type SessionEndReason = "signed_out" | "expired";

/** Everything components need to know about, and do with, the session. */
export interface SessionContextValue {
  /** The signed-in staff member, or null when signed out. */
  user: AuthUser | null;
  /** Set after a session ends; cleared on the next successful sign-in. */
  endReason: SessionEndReason | null;
  /** Authenticated API. Safe to call when signed out: requests just fail as `unauthorized`. */
  api: PaySupportApi;
  /** Signs in and starts a session. Resolves to the user, or a typed failure. */
  signIn: (credentials: LoginCredentials, options?: RequestOptions) => Promise<ApiResult<AuthUser>>;
  /** Ends the session on this device. */
  signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Props for {@link SessionProvider}. */
export interface SessionProviderProps {
  children: ReactNode;
}

/**
 * Owns the signed-in session for the whole app.
 *
 * SECURITY: the token lives only in memory, in a ref inside this provider.
 * It is never written to localStorage, sessionStorage, or a cookie, so an
 * XSS bug can't read it back out of storage, and it is never exposed
 * through context, so no component can render or log it by mistake.
 *
 * Tradeoff: the session ends when the page is refreshed or the tab is
 * closed, and each tab signs in separately. For a support tool used during
 * a shift that's an acceptable cost. The production path is an httpOnly,
 * Secure, SameSite=Strict cookie set by the API: JavaScript can't read it
 * at all, and it survives refreshes. That needs backend changes (cookie
 * issuing, CSRF protection, a logout endpoint), so it's out of scope here.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);
  // A ref, not state: the API client reads the token at request time, so
  // the `api` object below can be created once and stay stable.
  const tokenRef = useRef<string | null>(null);

  const endSession = useCallback((reason: SessionEndReason) => {
    tokenRef.current = null;
    setUser(null);
    setEndReason(reason);
  }, []);

  const api = useMemo(
    () =>
      createPaySupportApi({
        getToken: () => tokenRef.current,
        onUnauthorized: (rejectedToken) => {
          // A slow request from a previous session can 401 after the user
          // has signed in again. Only the current token's rejection ends
          // the current session.
          if (rejectedToken === tokenRef.current) endSession("expired");
        },
      }),
    [endSession],
  );

  const signIn = useCallback(
    async (credentials: LoginCredentials, options?: RequestOptions): Promise<ApiResult<AuthUser>> => {
      // publicApi sends no token, so a 401 here means wrong credentials
      // and can't trigger onUnauthorized.
      const result = await publicApi.login(credentials, options);
      if (!result.ok) return result;

      tokenRef.current = result.data.token;
      setUser(result.data.user);
      setEndReason(null);
      return { ok: true, data: result.data.user };
    },
    [],
  );

  /*
   * Sign-out only forgets the token on this device. The API has no logout
   * endpoint, so a copied token stays valid until it expires (8h by
   * default). Server-side revocation needs a token denylist or short-lived
   * tokens with refresh, which belong with the httpOnly cookie work above.
   */
  const signOut = useCallback(() => {
    endSession("signed_out");
  }, [endSession]);

  const value = useMemo<SessionContextValue>(
    () => ({ user, endReason, api, signIn, signOut }),
    [user, endReason, api, signIn, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

/**
 * Reads the session. Must be used inside {@link SessionProvider}.
 *
 * @throws If called outside the provider, which is a programming error, not a user-facing state.
 */
export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error("useSession must be used inside <SessionProvider>.");
  }
  return context;
}
