import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { diagnosisFixtures, loginResponseFixture, reconciliationSummaryFixture } from "../../test/fixtures";
import { renderApp, signIn } from "../../test/renderApp";
import { server } from "../../test/server";

/*
 * The workspace, driven through the whole app. The default MSW handlers
 * sign in an engineer and return two discrepancies: Priya's open status
 * mismatch and Jordan's resolved amount mismatch.
 */

const RUN_URL = "*/api/reconciliation/run";
const LIST_URL = "*/api/reconciliation/discrepancies";

async function openWorkspace() {
  const view = renderApp("/");
  await signIn(view.user);
  await screen.findByRole("heading", { level: 1, name: "Transaction support" });
  return view;
}

/** The value shown for one metric, found through its label, the way a screen reader pairs them. */
function metric(label: string) {
  const term = screen.getByText(label, { selector: "dt" });
  const tile = term.parentElement;
  if (!tile) throw new Error(`No tile for metric "${label}"`);
  return within(tile);
}

function queue() {
  return within(screen.getByRole("region", { name: "Discrepancy queue" }));
}

describe("workspace", () => {
  it("summarises open findings in the metrics strip", async () => {
    await openWorkspace();

    expect(await metric("Open discrepancies").findByText("1")).toBeInTheDocument();
    expect(metric("Status mismatches").getByText("1")).toBeInTheDocument();
    // Jordan's amount mismatch is resolved, so it doesn't count.
    expect(metric("Amount mismatches").getByText("0")).toBeInTheDocument();
    expect(metric("Last sweep").getByText("None yet")).toBeInTheDocument();
  });

  it("shows open findings first and filters by state", async () => {
    const { user } = await openWorkspace();
    await queue().findByText("Priya Natarajan");
    expect(queue().queryByText("Jordan Reyes")).not.toBeInTheDocument();

    await user.click(queue().getByRole("button", { name: /^Resolved/ }));
    expect(queue().getByText("Jordan Reyes")).toBeInTheDocument();
    expect(queue().queryByText("Priya Natarajan")).not.toBeInTheDocument();
    expect(queue().getByRole("button", { name: /^Resolved/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(queue().getByRole("button", { name: /^All findings/ }));
    expect(queue().getByText("Showing 2 of 2 findings")).toBeInTheDocument();
  });

  it("searches by customer and explains when nothing matches", async () => {
    const { user } = await openWorkspace();
    await queue().findByText("Priya Natarajan");
    await user.click(queue().getByRole("button", { name: /^All findings/ }));

    await user.type(queue().getByLabelText("Search"), "jordan");
    expect(queue().getByText("Jordan Reyes")).toBeInTheDocument();
    expect(queue().queryByText("Priya Natarajan")).not.toBeInTheDocument();

    await user.clear(queue().getByLabelText("Search"));
    await user.type(queue().getByLabelText("Search"), "zzz");
    expect(queue().getByText("No findings match “zzz”.")).toBeInTheDocument();
  });

  it("opens the full diagnosis from a queue row", async () => {
    const { user } = await openWorkspace();

    await user.click(await queue().findByRole("link", { name: "Investigate Priya Natarajan’s transaction" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Transaction diagnosis" })).toBeInTheDocument();
    expect(await screen.findByText("Status mismatch")).toBeInTheDocument();
  });

  it("checks the lookup form, then opens the diagnosis", async () => {
    const { user } = await openWorkspace();
    const field = screen.getByLabelText("Transaction ID");

    await user.click(screen.getByRole("button", { name: "Diagnose" }));
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription(/Enter a transaction ID/);

    await user.type(field, diagnosisFixtures.match.transactionId);
    await user.click(screen.getByRole("button", { name: "Diagnose" }));
    expect(await screen.findByText("Records match")).toBeInTheDocument();
  });

  it("asks for confirmation before a sweep, and Cancel sends nothing", async () => {
    let runs = 0;
    server.use(
      http.post(RUN_URL, () => {
        runs += 1;
        return HttpResponse.json(reconciliationSummaryFixture);
      }),
    );
    const { user } = await openWorkspace();

    await user.click(screen.getByRole("button", { name: "Run reconciliation sweep" }));
    const dialog = screen.getByRole("dialog", { name: "Run a reconciliation sweep?" });
    expect(within(dialog).getByText(/up to two minutes/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(runs).toBe(0);
  });

  it("runs a confirmed sweep, reports the result, and refreshes the queue", async () => {
    let listRequests = 0;
    server.use(
      http.get(LIST_URL, () => {
        listRequests += 1;
        return HttpResponse.json({ discrepancies: [] });
      }),
    );
    const { user } = await openWorkspace();
    await queue().findByText("No open discrepancies.");

    await user.click(screen.getByRole("button", { name: "Run reconciliation sweep" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run sweep" }));

    expect(await screen.findByText(/Checked 4 transactions: 2 matched and 2 had discrepancies/)).toBeInTheDocument();
    expect(metric("Last sweep").getByText("4")).toBeInTheDocument();
    expect(listRequests).toBe(2);
  });

  it("says how many transactions the processor couldn’t check", async () => {
    server.use(http.post(RUN_URL, () => HttpResponse.json({ ...reconciliationSummaryFixture, scanned: 5 })));
    const { user } = await openWorkspace();

    await user.click(screen.getByRole("button", { name: "Run reconciliation sweep" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run sweep" }));

    expect(await screen.findByText(/and 1 couldn.t be checked/)).toBeInTheDocument();
  });

  it("explains a 403 from the sweep in plain language", async () => {
    server.use(
      http.post(RUN_URL, () =>
        HttpResponse.json({ error: "forbidden", message: "Requires role: engineer or admin" }, { status: 403 }),
      ),
    );
    const { user } = await openWorkspace();

    await user.click(screen.getByRole("button", { name: "Run reconciliation sweep" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run sweep" }));

    expect(await screen.findByText("You don’t have access to run sweeps.")).toBeInTheDocument();
  });

  it("explains to support users why there's no sweep button", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json({ ...loginResponseFixture, user: { ...loginResponseFixture.user, role: "support" } }),
      ),
      http.get(LIST_URL, () => HttpResponse.json({ discrepancies: [] })),
    );
    await openWorkspace();

    expect(screen.queryByRole("button", { name: "Run reconciliation sweep" })).not.toBeInTheDocument();
    expect(screen.getByText("Reconciliation sweeps are run by engineers and admins.")).toBeInTheDocument();
    expect(await queue().findByText(/after an engineer runs a sweep/)).toBeInTheDocument();
  });

  it("recovers when the queue fails to load", async () => {
    server.use(http.get(LIST_URL, () => HttpResponse.error()));
    const { user } = await openWorkspace();
    expect(await queue().findByText(/Couldn.t load the queue/)).toBeInTheDocument();
    expect(metric("Open discrepancies").getByText("Unavailable")).toBeInTheDocument();

    server.resetHandlers();
    await user.click(queue().getByRole("button", { name: "Try again" }));

    expect(await queue().findByText("Priya Natarajan")).toBeInTheDocument();
  });
});
