import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { diagnosisFixtures, discrepancyRowFixtures, TEST_CREDENTIALS, TEST_TOKEN } from "../test/fixtures";
import { server } from "../test/server";
import { createPaySupportApi, publicApi } from "./endpoints";
import type { DiagnosisOutcome } from "./schemas";

/*
 * Covers what each endpoint function adds on top of the client: the
 * method and path, encoding, query strings, and the schema it validates
 * against. The default MSW handlers (src/test/handlers.ts) act as the API.
 */

const api = createPaySupportApi({ getToken: () => TEST_TOKEN });

describe("login", () => {
  it("returns the token and user for valid credentials", async () => {
    const result = await publicApi.login(TEST_CREDENTIALS);

    expect(result).toEqual({
      ok: true,
      data: {
        token: TEST_TOKEN,
        user: { id: expect.any(String) as string, email: TEST_CREDENTIALS.email, role: "engineer" },
      },
    });
  });

  it("reports wrong credentials as unauthorized", async () => {
    const result = await publicApi.login({ email: TEST_CREDENTIALS.email, password: "wrong" });

    expect(result).toMatchObject({ ok: false, error: { kind: "unauthorized" } });
  });
});

describe("diagnoseTransaction", () => {
  const outcomes = Object.keys(diagnosisFixtures) as DiagnosisOutcome[];

  it.each(outcomes)("parses a %s report", async (outcome) => {
    const fixture = diagnosisFixtures[outcome];

    const result = await api.diagnoseTransaction(fixture.transactionId);

    expect(result).toEqual({ ok: true, data: fixture });
  });

  it("reports an unknown ID as not_found", async () => {
    const result = await api.diagnoseTransaction("e1111111-0000-0000-0000-000000000999");

    expect(result).toMatchObject({ ok: false, error: { kind: "not_found" } });
  });

  it("encodes the ID so it can't change which endpoint is called", async () => {
    let requestedPath = "";
    server.use(
      http.get("*/api/transactions/:id/diagnose", ({ request }) => {
        requestedPath = new URL(request.url).pathname;
        return HttpResponse.json(diagnosisFixtures.match);
      }),
    );

    await api.diagnoseTransaction("../accounts?x=1");

    expect(requestedPath).toBe("/api/transactions/..%2Faccounts%3Fx%3D1/diagnose");
  });

  it("requires a session", async () => {
    const result = await publicApi.diagnoseTransaction(diagnosisFixtures.match.transactionId);

    expect(result).toMatchObject({ ok: false, error: { kind: "unauthorized" } });
  });
});

describe("runReconciliation", () => {
  it("returns the sweep summary", async () => {
    const result = await api.runReconciliation();

    expect(result).toMatchObject({ ok: true, data: { scanned: 4, matched: 2, discrepanciesFound: 2 } });
  });

  it("reports a role without permission as forbidden", async () => {
    server.use(
      http.post("*/api/reconciliation/run", () =>
        HttpResponse.json({ error: "forbidden", message: "Requires role: engineer or admin" }, { status: 403 }),
      ),
    );

    const result = await api.runReconciliation();

    expect(result).toMatchObject({ ok: false, error: { kind: "forbidden" } });
  });
});

describe("listDiscrepancies", () => {
  it("converts rows to camelCase", async () => {
    const result = await api.listDiscrepancies();
    const row = discrepancyRowFixtures[0];
    if (!row) throw new Error("Expected at least one discrepancy fixture");

    expect(result.ok && result.data[0]).toEqual({
      id: row.id,
      transactionId: row.transaction_id,
      type: row.discrepancy_type,
      internalStatus: row.internal_status,
      vendorStatus: row.vendor_status,
      internalAmountCents: row.internal_amount_cents,
      vendorAmountCents: row.vendor_amount_cents,
      resolved: row.resolved,
      createdAt: row.created_at,
      customerName: row.customer_name,
      accountEmail: row.account_email,
    });
  });

  it("sends the resolved filter as a query parameter", async () => {
    const result = await api.listDiscrepancies({ resolved: false });

    expect(result.ok && result.data.map((d) => d.resolved)).toEqual([false]);
  });

  it("omits the filter to list every discrepancy", async () => {
    let search: string | null = null;
    server.use(
      http.get("*/api/reconciliation/discrepancies", ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({ discrepancies: [] });
      }),
    );

    await api.listDiscrepancies();

    expect(search).toBe("");
  });
});
