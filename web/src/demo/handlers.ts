import { delay, http, HttpResponse } from "msw";
import type { z } from "zod";

import type { discrepancySchema } from "../api/schemas";
import { DEMO_PASSWORD, demoDiagnoses, demoUsers, discrepancyRow, roleForToken, sweepResult } from "./data";

/*
 * The API as it behaves in the browser-only demo. Same rules as the real
 * one where the UI depends on them: protected routes need a bearer token,
 * unknown IDs are 404s, and only engineers and admins may run a sweep
 * (support gets the API's 403, which the dashboard explains).
 *
 * Responses are delayed by roughly what the real stack takes, so loading
 * states show up the way they would against the real API instead of
 * flashing past.
 *
 * State lives in memory and resets on reload, which matches the real
 * dashboard: the session is memory-only too, so a reload signs you out.
 */

type DiscrepancyRow = z.input<typeof discrepancySchema>;

/** Starts empty, like the seeded database: a sweep is what fills the queue. */
let discrepancies: DiscrepancyRow[] = [];

/** Empties the queue again. Tests call this so each one starts like a fresh page load. */
export function resetDemoState(): void {
  discrepancies = [];
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

function unauthorized() {
  return HttpResponse.json({ error: "unauthorized", message: "Missing or invalid bearer token" }, { status: 401 });
}

export const demoHandlers = [
  http.get("*/api/health", async () => {
    await delay(150);
    return HttpResponse.json({ status: "ok", service: "paysupport-api" });
  }),

  http.post("*/api/auth/login", async ({ request }) => {
    await delay(500);
    const body: unknown = await request.json();
    const email = typeof body === "object" && body !== null && "email" in body ? String(body.email).toLowerCase() : "";
    const password = typeof body === "object" && body !== null && "password" in body ? body.password : null;
    const account = demoUsers[email];
    if (!account || password !== DEMO_PASSWORD) {
      return HttpResponse.json(
        { error: "invalid_credentials", message: "Email or password is incorrect" },
        { status: 401 },
      );
    }
    return HttpResponse.json(account);
  }),

  http.get<{ id: string }>("*/api/transactions/:id/diagnose", async ({ request, params }) => {
    await delay(700);
    const token = bearerToken(request);
    if (!token || !roleForToken(token)) return unauthorized();
    const report = demoDiagnoses.find((d) => d.transactionId === params.id);
    if (!report) {
      return HttpResponse.json({ error: "not_found", message: `No transaction with id ${params.id}` }, { status: 404 });
    }
    return HttpResponse.json(report);
  }),

  http.post("*/api/reconciliation/run", async ({ request }) => {
    const token = bearerToken(request);
    const role = token ? roleForToken(token) : null;
    if (!role) return unauthorized();
    if (role === "support") {
      await delay(300);
      return HttpResponse.json(
        { error: "forbidden", message: "Reconciliation sweeps are limited to engineers and admins" },
        { status: 403 },
      );
    }
    // A real sweep calls the processor once per payment, so it takes a moment.
    await delay(1800);
    const summary = sweepResult();
    const detectedAt = new Date();
    // Like the API, only new findings are stored: a second sweep doesn't duplicate rows.
    for (const finding of summary.discrepancies) {
      if (discrepancies.some((row) => row.transaction_id === finding.transactionId)) continue;
      const row = discrepancyRow(finding.transactionId, discrepancies.length, detectedAt);
      if (row) discrepancies = [...discrepancies, row];
    }
    return HttpResponse.json(summary);
  }),

  http.get("*/api/reconciliation/discrepancies", async ({ request }) => {
    await delay(400);
    const token = bearerToken(request);
    if (!token || !roleForToken(token)) return unauthorized();
    // Same parsing as the API: absent means all, anything but "true" means false.
    const resolvedParam = new URL(request.url).searchParams.get("resolved");
    const rows =
      resolvedParam === null ? discrepancies : discrepancies.filter((row) => row.resolved === (resolvedParam === "true"));
    return HttpResponse.json({ discrepancies: rows });
  }),
];
