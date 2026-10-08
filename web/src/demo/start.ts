import { setupWorker } from "msw/browser";

import { demoHandlers } from "./handlers";
// Loaded here rather than in DemoBanner.tsx so only the demo build includes it.
import "./DemoBanner.css";

/**
 * Starts the in-browser API for the demo build. Mock Service Worker
 * intercepts the dashboard's real fetch calls, so the API client, its
 * timeouts and its Zod validation all run exactly as they do against the
 * real API. Nothing about the app itself is mocked.
 *
 * Only loaded when VITE_DEMO_MODE is "true" (see main.tsx), so the normal
 * build never includes it.
 */
export async function startDemoApi(): Promise<void> {
  const worker = setupWorker(...demoHandlers);
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    // Requests the demo doesn't handle (the app's own files) go to the network as usual.
    onUnhandledRequest: "bypass",
    quiet: true,
  });
}
