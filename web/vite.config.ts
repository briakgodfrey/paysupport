import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
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

/**
 * The origin requests may go to besides our own. Empty when the API is
 * same-origin ("/api", the default). If VITE_API_BASE_URL is a full URL on
 * another host, the CSP must allow exactly that origin, or every request
 * would be blocked in production with no obvious cause.
 */
function apiOrigin(apiBaseUrl: string | undefined): string | null {
  if (apiBaseUrl === undefined || apiBaseUrl.trim() === "" || apiBaseUrl.startsWith("/")) return null;
  return new URL(apiBaseUrl).origin;
}

/**
 * Content Security Policy for the production build: the browser refuses
 * anything this list doesn't allow. It's defense in depth against XSS. If
 * an attacker ever got markup into the page (say, a crafted customer name
 * from the ledger), injected scripts still couldn't run or send data out.
 *
 * Strict is possible because of choices made elsewhere: no inline styles
 * or dangerouslySetInnerHTML (both banned by lint), system fonts, and no
 * third-party scripts or CDNs.
 *
 * Build only, on purpose. The dev server injects inline scripts for hot
 * reloading, which this policy would block. Don't loosen the policy to
 * make dev work; it isn't applied there.
 *
 * Delivered as a <meta> tag so the built files carry it anywhere they're
 * hosted. Meta tags can't set frame-ancestors (clickjacking protection) or
 * reporting, so production should also send this as an HTTP header from
 * the server, with frame-ancestors 'none' added.
 */
function contentSecurityPolicy(apiBaseUrl: string | undefined): Plugin {
  const extraConnect = apiOrigin(apiBaseUrl);
  const directives: Record<string, string[]> = {
    // Anything not listed below: our own origin only.
    "default-src": ["'self'"],
    // Only our bundled scripts. No inline scripts, no eval, no CDNs.
    "script-src": ["'self'"],
    // Only our built stylesheets. No <style> blocks or style="" attributes.
    "style-src": ["'self'"],
    // fetch() targets: the same-origin /api, plus a configured API origin if there is one.
    "connect-src": ["'self'", ...(extraConnect ? [extraConnect] : [])],
    // No images today; data: allows small inline icons if they're added.
    "img-src": ["'self'", "data:"],
    // No Flash or other plugins, ever.
    "object-src": ["'none'"],
    // Stops an injected <base href> from redirecting every relative URL to another site.
    "base-uri": ["'none'"],
    // Forms are handled in JavaScript; if one ever submits natively, it can only post to us.
    "form-action": ["'self'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  return {
    name: "paysupport-content-security-policy",
    apply: "build",
    transformIndexHtml() {
      // head-prepend: the policy must come before any script or stylesheet it governs.
      return [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" }];
    },
  };
}

export default defineConfig(({ mode }) => {
  // Only VITE_ variables, the same public set the app itself can see.
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_API_BASE_URL)],
    // The demo build ships the Mock Service Worker script and a static-host
    // fallback rule; the normal build has no public folder at all.
    publicDir: mode === "demo" ? "demo-public" : false,
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
  };
});
