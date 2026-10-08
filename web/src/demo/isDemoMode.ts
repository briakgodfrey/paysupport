/**
 * True only in the browser-only demo build (`npm run build:demo`), where
 * an in-browser mock stands in for the API. Vite replaces this at build
 * time, so the normal build drops every demo-only branch.
 */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
