import { http, HttpResponse } from "msw";

import {
  diagnosisFixtures,
  discrepancyRowFixtures,
  loginResponseFixture,
  reconciliationSummaryFixture,
  TEST_CREDENTIALS,
  TEST_TOKEN,
} from "./fixtures";

/*
 * Default "happy path" API responses shared by every test. Individual
 * tests override a handler with server.use(...) to simulate failures.
 *
 * Handlers mirror the real API's rules where tests depend on them:
 * protected routes return 401 without the test token, and unknown IDs
 * return 404. That way a test can't pass by forgetting the auth header.
 *
 * The "*" prefix matches any origin, so handlers work whether the client
 * resolves "/api" against jsdom's origin or a configured base URL.
 */

function isAuthorized(request: Request): boolean {
  return request.headers.get("Authorization") === `Bearer ${TEST_TOKEN}`;
}

function unauthorized() {
  return HttpResponse.json({ error: "unauthorized", message: "Missing bearer token" }, { status: 401 });
}

const diagnosisById = new Map(
  Object.values(diagnosisFixtures).map((report) => [report.transactionId, report] as const),
);

export const handlers = [
  http.get("*/api/health", () => HttpResponse.json({ status: "ok", service: "paysupport-api" })),

  http.post("*/api/auth/login", async ({ request }) => {
    const body: unknown = await request.json();
    const matches =
      typeof body === "object" &&
      body !== null &&
      "email" in body &&
      "password" in body &&
      body.email === TEST_CREDENTIALS.email &&
      body.password === TEST_CREDENTIALS.password;
    if (!matches) {
      return HttpResponse.json(
        { error: "invalid_credentials", message: "Email or password is incorrect" },
        { status: 401 },
      );
    }
    return HttpResponse.json(loginResponseFixture);
  }),

  http.get<{ id: string }>("*/api/transactions/:id/diagnose", ({ request, params }) => {
    if (!isAuthorized(request)) return unauthorized();
    const report = diagnosisById.get(params.id);
    if (!report) {
      return HttpResponse.json(
        { error: "not_found", message: `No transaction with id ${params.id}` },
        { status: 404 },
      );
    }
    return HttpResponse.json(report);
  }),

  http.post("*/api/reconciliation/run", ({ request }) => {
    if (!isAuthorized(request)) return unauthorized();
    return HttpResponse.json(reconciliationSummaryFixture);
  }),

  http.get("*/api/reconciliation/discrepancies", ({ request }) => {
    if (!isAuthorized(request)) return unauthorized();
    // Same parsing as the API: absent means all, anything but "true" means false.
    const resolvedParam = new URL(request.url).searchParams.get("resolved");
    const discrepancies =
      resolvedParam === null
        ? discrepancyRowFixtures
        : discrepancyRowFixtures.filter((row) => row.resolved === (resolvedParam === "true"));
    return HttpResponse.json({ discrepancies });
  }),
];
