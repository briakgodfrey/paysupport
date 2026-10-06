import { describe, expect, it } from "vitest";

import { diagnosisFixtures, loginResponseFixture } from "../test/fixtures";
import { diagnosisReportSchema, discrepancySchema, loginResponseSchema } from "./schemas";

/*
 * Schema rules that protect the UI from bad data. Each test describes a
 * response the API should never send, and checks that it is rejected
 * rather than rendered.
 */

describe("diagnosisReportSchema", () => {
  it("rejects a compared outcome without vendor data", () => {
    const report = { ...diagnosisFixtures.match, vendor: null };

    expect(diagnosisReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects vendor data on an outcome that has none", () => {
    const report = { ...diagnosisFixtures.vendor_unavailable, vendor: { status: "settled", amountCents: 1 } };

    expect(diagnosisReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects an outcome the UI doesn't know how to explain", () => {
    const report = { ...diagnosisFixtures.match, outcome: "partially_matched" };

    expect(diagnosisReportSchema.safeParse(report).success).toBe(false);
  });

  it("rejects fractional cents", () => {
    const report = {
      ...diagnosisFixtures.match,
      internal: { ...diagnosisFixtures.match.internal, amountCents: 45.99 },
    };

    expect(diagnosisReportSchema.safeParse(report).success).toBe(false);
  });

  it("accepts a status value it hasn't seen before, since statuses are display-only", () => {
    const report = { ...diagnosisFixtures.match, vendor: { status: "captured", amountCents: 4599 } };

    expect(diagnosisReportSchema.safeParse(report).success).toBe(true);
  });
});

describe("loginResponseSchema", () => {
  it("rejects a token that would be unsafe in an Authorization header", () => {
    const response = { ...loginResponseFixture, token: "a.b.c\r\nX-Injected: 1" };

    expect(loginResponseSchema.safeParse(response).success).toBe(false);
  });

  it("rejects a role the dashboard doesn't recognise", () => {
    const response = { ...loginResponseFixture, user: { ...loginResponseFixture.user, role: "superuser" } };

    expect(loginResponseSchema.safeParse(response).success).toBe(false);
  });
});

describe("discrepancySchema", () => {
  it("rejects a created_at that isn't a timestamp", () => {
    const row = {
      id: "f1",
      transaction_id: "e1",
      discrepancy_type: "status_mismatch",
      internal_status: "pending",
      vendor_status: "settled",
      internal_amount_cents: 100,
      vendor_amount_cents: 100,
      resolved: false,
      created_at: "yesterday",
      customer_name: "Test Customer",
      account_email: "customer@example.test",
    };

    expect(discrepancySchema.safeParse(row).success).toBe(false);
  });
});
