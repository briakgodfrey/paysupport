import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Where the Express API listens during local development (see src/config/env.ts). */
const API_DEV_TARGET = "http://localhost:4000";

/**
 * The browser only ever talks to its own origin at /api, and Vite forwards
 * those requests to the API. That keeps the API URL out of the bundle,
 * avoids relying on the API's open CORS policy, and mirrors the production
 * setup where a reverse proxy serves the app and the API from one origin.
 * The /api prefix is stripped because the API mounts its routes at the root.
 */
const apiProxy = {
  "/api": {
    target: API_DEV_TARGET,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail loudly if 5173 is taken instead of silently moving ports, so the
    // URL in the README and in your bookmarks is always the right one.
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: apiProxy,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
