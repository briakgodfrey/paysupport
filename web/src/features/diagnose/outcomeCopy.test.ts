import { describe, expect, it } from "vitest";

import { diagnosisReportSchema, type DiagnosisOutcome } from "../../api/schemas";
import { diagnosisFixtures } from "../../test/fixtures";
import { explainOutcome } from "./outcomeCopy";

/** Fixtures are wire-format; parse them so the tests use the same typed reports the UI does. */
function report(outcome: DiagnosisOutcome) {
  return diagnosisReportSchema.parse(diagnosisFixtures[outcome]);
}

describe("explainOutcome", () => {
  it.each(Object.keys(diagnosisFixtures) as DiagnosisOutcome[])(
    "gives %s a label, headline, explanation, and next step",
    (outcome) => {
      const copy = explainOutcome(report(outcome));

      for (const text of [copy.label, copy.headline, copy.explanation, copy.nextStep]) {
        expect(text.trim()).not.toBe("");
      }
      // The developer-facing API note must never be the main message.
      expect(copy.headline).not.toContain(report(outcome).notes);
    },
  );

  it("never calls a processor outage a failure", () => {
    const copy = explainOutcome(report("vendor_unavailable"));

    expect(copy.tone).toBe("info");
    expect(copy.nextStep).toMatch(/don.t tell the customer anything has gone wrong/i);
  });

  it("uses the real statuses in a status mismatch", () => {
    const copy = explainOutcome(report("status_mismatch"));

    expect(copy.headline).toBe("Our ledger says pending, but the processor says settled.");
  });

  it("flags a status difference hidden behind an amount mismatch", () => {
    // The API reports only the amount problem for this payment, but the
    // statuses differ too (pending vs settled).
    const copy = explainOutcome(report("amount_mismatch"));

    expect(copy.headline).toMatch(/\$0\.50 higher than our ledger/);
    expect(copy.explanation).toContain("The status also differs: our ledger says pending, but the processor says settled.");
    expect(copy.nextStep).toMatch(/correct the ledger status/);
  });

  it("keeps the simpler advice when only the amount differs", () => {
    const base = report("amount_mismatch");
    if (base.vendor === null) throw new Error("Expected vendor data on an amount mismatch fixture");
    const amountOnly = { ...base, vendor: { ...base.vendor, status: "pending" } };

    const copy = explainOutcome(amountOnly);

    expect(copy.explanation).not.toMatch(/status also differs/);
    expect(copy.nextStep).not.toMatch(/ledger status/);
  });
});
