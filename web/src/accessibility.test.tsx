import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { diagnosisFixtures, loginResponseFixture, TEST_CREDENTIALS } from "./test/fixtures";
import { expectNoAxeViolations } from "./test/axe";
import { renderApp, signIn } from "./test/renderApp";
import { server } from "./test/server";

/*
 * axe checks for every page in the states a user can actually reach,
 * including errors and dialogs, where accessibility bugs tend to hide.
 * Each test waits for the state to finish rendering before checking, so
 * axe sees what a user would see rather than a loading flash.
 */

async function signedIn(path: string) {
  const view = renderApp(path);
  await signIn(view.user);
  return view;
}

describe("accessibility (axe)", () => {
  // A check that can't fail proves nothing. This one must fail, or the
  // helper is misconfigured and every passing test below is meaningless.
  it("catches known violations (canary)", async () => {
    render(
      <main>
        <h1>Canary</h1>
        <input type="text" />
        <button type="button" />
      </main>,
    );

    await expect(expectNoAxeViolations()).rejects.toThrow(/label|button-name/);
  });

  describe("sign-in", () => {
    it("empty form", async () => {
      renderApp("/sign-in");
      await screen.findByText("API connected");

      await expectNoAxeViolations();
    });

    it("with field errors", async () => {
      const { user } = renderApp("/sign-in");
      await user.click(screen.getByRole("button", { name: "Sign in" }));
      await screen.findByText("Enter your email address.");

      await expectNoAxeViolations();
    });

    it("after wrong credentials", async () => {
      const { user } = renderApp("/sign-in");
      await user.type(screen.getByLabelText("Email"), TEST_CREDENTIALS.email);
      await user.type(screen.getByLabelText("Password"), "wrong-password");
      await user.click(screen.getByRole("button", { name: "Sign in" }));
      await screen.findByText(/don.t match an account/);

      await expectNoAxeViolations();
    });

    it("with the API unavailable", async () => {
      server.use(http.get("*/api/health", () => HttpResponse.error()));
      renderApp("/sign-in");
      await screen.findByRole("heading", { name: /can.t reach the paysupport api/i });

      await expectNoAxeViolations();
    });
  });

  describe("workspace", () => {
    it("as an engineer, with findings loaded", async () => {
      await signedIn("/");
      await screen.findByText("Priya Natarajan");

      await expectNoAxeViolations();
    });

    it("with the sweep confirmation open", async () => {
      const { user } = await signedIn("/");
      await screen.findByText("Priya Natarajan");
      await user.click(screen.getByRole("button", { name: "Run reconciliation sweep" }));
      screen.getByRole("dialog", { name: "Run a reconciliation sweep?" });

      await expectNoAxeViolations();
    });

    it("after a sweep completes", async () => {
      const { user } = await signedIn("/");
      await screen.findByText("Priya Natarajan");
      await user.click(screen.getByRole("button", { name: "Run reconciliation sweep" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run sweep" }));
      await screen.findByText(/Sweep complete/);

      await expectNoAxeViolations();
    });

    it("as support, with an empty queue", async () => {
      server.use(
        http.post("*/api/auth/login", () =>
          HttpResponse.json({ ...loginResponseFixture, user: { ...loginResponseFixture.user, role: "support" } }),
        ),
        http.get("*/api/reconciliation/discrepancies", () => HttpResponse.json({ discrepancies: [] })),
      );
      await signedIn("/");
      await screen.findByText("No open discrepancies.");

      await expectNoAxeViolations();
    });

    it("when the queue fails to load", async () => {
      server.use(http.get("*/api/reconciliation/discrepancies", () => HttpResponse.error()));
      await signedIn("/");
      await screen.findByText(/Couldn.t load the queue/);

      await expectNoAxeViolations();
    });
  });

  describe("diagnosis", () => {
    it.each(["amount_mismatch", "vendor_unavailable", "no_vendor_ref"] as const)("%s result", async (outcome) => {
      await signedIn(`/diagnose/${diagnosisFixtures[outcome].transactionId}`);
      await screen.findByText("Next step:");

      await expectNoAxeViolations();
    });

    it("unknown transaction", async () => {
      await signedIn("/diagnose/e1111111-0000-0000-0000-000000000999");
      await screen.findByText("There’s no transaction with that ID.");

      await expectNoAxeViolations();
    });

    it("malformed ID in the link", async () => {
      await signedIn("/diagnose/not-an-id");
      await screen.findByText("That isn’t a valid transaction ID.");

      await expectNoAxeViolations();
    });
  });

  it("page not found", async () => {
    renderApp("/no-such-page");
    await screen.findByRole("heading", { level: 1, name: "Page not found" });

    await expectNoAxeViolations();
  });
});
