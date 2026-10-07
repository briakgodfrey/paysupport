import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { DiagnosisOutcome } from "../../api/schemas";
import { diagnosisFixtures } from "../../test/fixtures";
import { renderApp, signIn } from "../../test/renderApp";
import { server } from "../../test/server";

/*
 * Each test opens a /diagnose/:id link while signed out, signs in, and
 * lands back on the result: the "engineer pastes a link from a ticket"
 * path, end to end against the MSW API.
 */

const DIAGNOSE_URL = "*/api/transactions/:id/diagnose";

async function openDiagnosis(id: string) {
  const view = renderApp(`/diagnose/${id}`);
  await signIn(view.user);
  return view;
}

const OUTCOME_LABELS: Record<DiagnosisOutcome, string> = {
  match: "Records match",
  status_mismatch: "Status mismatch",
  amount_mismatch: "Amount mismatch",
  vendor_not_found: "Processor has no record",
  vendor_unavailable: "Processor unavailable",
  no_vendor_ref: "No processor reference",
};

describe("diagnosis page", () => {
  it.each(Object.keys(OUTCOME_LABELS) as DiagnosisOutcome[])(
    "returns to a pasted %s link after sign-in and shows the verdict and next step",
    async (outcome) => {
      await openDiagnosis(diagnosisFixtures[outcome].transactionId);

      expect(await screen.findByText(OUTCOME_LABELS[outcome])).toBeInTheDocument();
      expect(screen.getByText("Next step:")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "Transaction diagnosis" })).toBeInTheDocument();
    },
  );

  it("spells out each difference in the comparison table", async () => {
    await openDiagnosis(diagnosisFixtures.amount_mismatch.transactionId);

    const table = await screen.findByRole("table");
    const statusRow = within(table).getByRole("row", { name: /^Status/ });
    const amountRow = within(table).getByRole("row", { name: /^Amount/ });
    expect(within(statusRow).getByText(/Differs/)).toBeInTheDocument();
    expect(within(amountRow).getByText(/Differs: processor is \$0\.50 higher/)).toBeInTheDocument();
  });

  it("warns that the status also differs when the API only reports the amount", async () => {
    await openDiagnosis(diagnosisFixtures.amount_mismatch.transactionId);

    expect(await screen.findByText(/The status also differs: our ledger says pending/)).toBeInTheDocument();
  });

  it("lets the user check the processor again after an outage", async () => {
    const id = diagnosisFixtures.vendor_unavailable.transactionId;
    let requests = 0;
    server.use(
      http.get(DIAGNOSE_URL, () => {
        requests += 1;
        // First answer: processor down. Second: it's back and the records agree.
        return HttpResponse.json(
          requests === 1 ? diagnosisFixtures.vendor_unavailable : { ...diagnosisFixtures.match, transactionId: id },
        );
      }),
    );
    const { user } = await openDiagnosis(id);
    await screen.findByText("Processor unavailable");

    await user.click(screen.getByRole("button", { name: "Check the processor again" }));

    expect(await screen.findByText("Records match")).toBeInTheDocument();
    expect(requests).toBe(2);
  });

  it("rejects a malformed ID without calling the API", async () => {
    let requests = 0;
    server.use(
      http.get(DIAGNOSE_URL, () => {
        requests += 1;
        return HttpResponse.json(diagnosisFixtures.match);
      }),
    );

    await openDiagnosis("not-an-id");

    expect(await screen.findByText("That isn’t a valid transaction ID.")).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it("explains an unknown transaction and offers no pointless retry", async () => {
    await openDiagnosis("e1111111-0000-0000-0000-000000000999");

    const alert = screen.getByRole("alert");
    expect(await within(alert).findByText("There’s no transaction with that ID.")).toBeInTheDocument();
    expect(within(alert).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("recovers from a network failure with Try again", async () => {
    server.use(http.get(DIAGNOSE_URL, () => HttpResponse.error()));
    const { user } = await openDiagnosis(diagnosisFixtures.match.transactionId);
    const alert = screen.getByRole("alert");
    await within(alert).findByText("Can’t reach the PaySupport API.");

    server.resetHandlers();
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Records match")).toBeInTheDocument();
  });

  it("copies the full transaction ID and confirms it", async () => {
    const id = diagnosisFixtures.match.transactionId;
    const { user } = await openDiagnosis(id);
    await screen.findByText("Records match");

    await user.click(screen.getByRole("button", { name: "Copy transaction ID" }));

    await expect(navigator.clipboard.readText()).resolves.toBe(id);
    expect(screen.getByRole("button", { name: "Copied transaction ID" })).toBeInTheDocument();
  });

  it("checks the lookup form before navigating to another diagnosis", async () => {
    const { user } = await openDiagnosis(diagnosisFixtures.match.transactionId);
    await screen.findByText("Records match");
    const field = screen.getByLabelText("Transaction ID");

    await user.type(field, "e1111111-oops");
    await user.click(screen.getByRole("button", { name: "Diagnose" }));
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription(/doesn.t look like a transaction ID/);

    await user.clear(field);
    await user.type(field, diagnosisFixtures.status_mismatch.transactionId);
    await user.click(screen.getByRole("button", { name: "Diagnose" }));
    expect(await screen.findByText("Status mismatch")).toBeInTheDocument();
  });
});
