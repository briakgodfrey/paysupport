import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { App } from "./App";
import { SessionProvider } from "./auth/SessionContext";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/button.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("index.html is missing the #root element the app mounts into.");
}
const root = rootElement;

/**
 * In the demo build, the in-browser API has to be listening before the app
 * makes its first request (the health check), so it starts first. The
 * dynamic import keeps the mock out of the normal build entirely.
 */
async function startApp(): Promise<void> {
  // Checked inline (not via demo/isDemoMode) so the bundler can see it's a
  // constant and drop the import from the normal build.
  if (import.meta.env.VITE_DEMO_MODE === "true") {
    const { startDemoApi } = await import("./demo/start");
    await startDemoApi();
  }

  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

void startApp();
