import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPaySupportApi } from "../api/endpoints";
import { server } from "../test/server";
import { DEMO_PASSWORD, demoDiagnoses, demoUsers } from "./data";
import { demoHandlers, resetDemoState } from "./handlers";

/*
 * The demo's in-browser API, exercised through the real API client. That
 * means every demo response also passes the app's own Zod validation, so
 * the demo data can't drift from the shape the dashboard expects without
 * a test failing.
 */

const engineerToken = demoUsers["engineer@paysupport.dev"]?.token ?? "";
const supportToken = demoUsers["support@paysupport.dev"]?.token ?? "";

function apiFor(token: string | null) {
  return createPaySupportApi({ getToken: () => token });
}

beforeEach(() => {
  server.use(...demoHandlers);
});

afterEach(() => {
  resetDemoState();
});

describe("demo API", () => {
  it("signs in every demo account with the shared password", async () => {
    for (const [email, account] of Object.entries(demoUsers)) {
      const result = await apiFor(null).login({ email, password: DEMO_PASSWORD });
      expect(result).toEqual({ ok: true, data: account });
    }
  });

  it("rejects a wrong password", async () => {
    const result = await apiFor(null).login({ email: "engineer@paysupport.dev", password: "nope" });
    expect(result).toMatchObject({ ok: false, error: { kind: "unauthorized" } });
  });

  it("returns a valid diagnosis for every demo transaction, covering all six outcomes", async () => {
    const outcomes = new Set<string>();
    for (const report of demoDiagnoses) {
      const result = await apiFor(engineerToken).diagnoseTransaction(report.transactionId);
      expect(result.ok).toBe(true);
      if (result.ok) outcomes.add(result.data.outcome);
    }
    expect(outcomes).toEqual(
      new Set(["match", "status_mismatch", "amount_mismatch", "vendor_not_found", "vendor_unavailable", "no_vendor_ref"]),
    );
  });

  it("needs a token, and 404s an unknown transaction, like the real API", async () => {
    const id = "e1111111-0000-0000-0000-000000000002";
    expect(await apiFor(null).diagnoseTransaction(id)).toMatchObject({ ok: false, error: { kind: "unauthorized" } });
    expect(await apiFor(engineerToken).diagnoseTransaction("e1111111-0000-0000-0000-000000000999")).toMatchObject({
      ok: false,
      error: { kind: "not_found" },
    });
  });

  it("starts with an empty queue, like the seeded database", async () => {
    expect(await apiFor(engineerToken).listDiscrepancies()).toEqual({ ok: true, data: [] });
  });

  it("only lets engineers and admins run a sweep", async () => {
    const result = await apiFor(supportToken).runReconciliation();
    expect(result).toMatchObject({ ok: false, error: { kind: "forbidden" } });
    expect(await apiFor(supportToken).listDiscrepancies()).toEqual({ ok: true, data: [] });
  });

  it("fills the queue from a sweep without duplicating findings on the next one", async () => {
    const api = apiFor(engineerToken);
    const first = await api.runReconciliation();
    expect(first).toMatchObject({ ok: true, data: { scanned: 4, matched: 2, discrepanciesFound: 2 } });

    await api.runReconciliation();
    const queue = await api.listDiscrepancies();
    expect(queue.ok).toBe(true);
    if (!queue.ok) return;
    expect(queue.data.map((row) => row.type).sort()).toEqual(["amount_mismatch", "status_mismatch"]);
    expect(queue.data.every((row) => !row.resolved)).toBe(true);
    expect(await api.listDiscrepancies({ resolved: true })).toEqual({ ok: true, data: [] });
  }, 15_000);
});
