import type { ReactNode } from "react";

import { useApiHealth } from "../hooks/useApiHealth";
import { OutageBanner } from "./OutageBanner";
import { StatusIndicator } from "./StatusIndicator";
import "./AppShell.css";

/** Props for {@link AppShell}. */
export interface AppShellProps {
  /** The current page. It should start with its own <h1>. */
  children: ReactNode;
}

/**
 * The frame around every page: skip link, header with the API status, and
 * the <main> landmark. Health polling lives here, not in each page, so
 * there is exactly one poller no matter which page is showing.
 */
export function AppShell({ children }: AppShellProps) {
  const health = useApiHealth();

  return (
    <>
      {/* First focusable element, so keyboard and switch users can bypass the header on every page (WCAG 2.4.1). */}
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="app-header">
        <div className="app-header__inner">
          <p className="app-header__brand">PaySupport</p>
          <StatusIndicator status={health.status} />
        </div>
      </header>

      {/* tabIndex={-1} lets the skip link (and, later, route changes) move focus here. */}
      <main id="main" className="app-main" tabIndex={-1}>
        {health.status === "unavailable" ? (
          <OutageBanner
            lastCheckedAt={health.lastCheckedAt}
            isChecking={health.isChecking}
            onCheckNow={health.checkNow}
          />
        ) : null}
        {children}
      </main>
    </>
  );
}
