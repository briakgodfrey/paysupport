import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router";

import { useSession } from "../auth/SessionContext";
import { useApiHealth } from "../hooks/useApiHealth";
import { formatRole } from "../lib/format";
import { OutageBanner } from "./OutageBanner";
import { StatusIndicator } from "./StatusIndicator";
import "./AppShell.css";

/**
 * Layout route for every page: skip link, header with API status and the
 * signed-in user, and the <main> landmark that child routes render into.
 *
 * Health polling lives here, not in each page, so there is exactly one
 * poller no matter which page is showing.
 */
export function AppShell() {
  const health = useApiHealth();
  const { user, signOut } = useSession();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);

  /*
   * In a single-page app, navigating doesn't reload the page, so screen
   * readers announce nothing and keyboard focus stays on the link that was
   * clicked (or on <body> if that link is gone). Moving focus to the new
   * page's <h1> fixes both. Initial page load is skipped so the skip link
   * stays the first thing a keyboard user reaches.
   */
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    mainRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [pathname]);

  return (
    <>
      {/* First focusable element, so keyboard and switch users can bypass the header on every page (WCAG 2.4.1). */}
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="app-header">
        <div className="app-header__inner">
          <Link className="app-header__brand" to="/">
            PaySupport
          </Link>

          <div className="app-header__end">
            <StatusIndicator status={health.status} />
            {user ? (
              <div className="app-header__session">
                <p className="app-header__identity">
                  <span className="visually-hidden">Signed in as </span>
                  <span className="app-header__email">{user.email}</span>
                  <span className="visually-hidden">, role: </span>
                  <span className="app-header__role">{formatRole(user.role)}</span>
                </p>
                <button type="button" className="button button--secondary" onClick={signOut}>
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* tabIndex={-1} lets the skip link move focus here. */}
      <main id="main" ref={mainRef} className="app-main" tabIndex={-1}>
        {health.status === "unavailable" ? (
          <OutageBanner
            lastCheckedAt={health.lastCheckedAt}
            isChecking={health.isChecking}
            onCheckNow={health.checkNow}
          />
        ) : null}
        <Outlet />
      </main>
    </>
  );
}
