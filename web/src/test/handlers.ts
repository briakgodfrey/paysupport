import { http, HttpResponse } from "msw";

/*
 * Default "happy path" API responses shared by every test. Individual
 * tests override a handler with server.use(...) to simulate failures.
 *
 * The "*" prefix matches any origin, so handlers work whether the client
 * resolves "/api" against jsdom's origin or a configured base URL.
 */
export const handlers = [
  http.get("*/api/health", () => HttpResponse.json({ status: "ok", service: "paysupport-api" })),
];
