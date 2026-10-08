/**
 * Shown on every page of the demo build, so nobody mistakes sample data
 * for a live payments system. It sits after the skip link and contains
 * nothing focusable, so keyboard users still reach "Skip to main content"
 * first.
 *
 * Its styles load with the demo API (see start.ts), so the normal build
 * carries none of them.
 *
 * Info colours, not warning or danger: nothing is wrong, and red is
 * reserved for the brand (see tokens.css).
 */
export function DemoBanner() {
  return (
    <aside className="demo-banner" aria-label="Demo mode">
      <p className="demo-banner__inner">
        <strong>Demo mode.</strong> Sample data, running entirely in your browser. No real payments, accounts, or
        servers are involved.
      </p>
    </aside>
  );
}
