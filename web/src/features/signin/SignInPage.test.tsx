import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { loginResponseFixture, TEST_CREDENTIALS } from "../../test/fixtures";
import { renderApp, signIn } from "../../test/renderApp";
import { server } from "../../test/server";

function emailInput() {
  return screen.getByLabelText("Email");
}

function passwordInput() {
  return screen.getByLabelText("Password");
}

function submitButton() {
  return screen.getByRole("button", { name: /^sign(ing)? in/i });
}

describe("sign-in", () => {
  it("sends a signed-out user to sign-in", async () => {
    renderApp("/");

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(document.title).toBe("Sign in · PaySupport");
  });

  it("explains empty fields and moves focus to the first one", async () => {
    const { user } = renderApp("/sign-in");

    await user.click(submitButton());

    expect(emailInput()).toHaveFocus();
    expect(emailInput()).toBeInvalid();
    expect(emailInput()).toHaveAccessibleDescription("Error: Enter your email address.");
    expect(passwordInput()).toHaveAccessibleDescription("Error: Enter your password.");
  });

  it("asks for a correctly formatted email", async () => {
    const { user } = renderApp("/sign-in");

    await user.type(emailInput(), "engineer at paysupport");
    await user.type(passwordInput(), "anything");
    await user.click(submitButton());

    expect(emailInput()).toHaveAccessibleDescription(/format name@company\.com/);
    expect(emailInput()).toHaveFocus();
  });

  it("clears a field's error as soon as the user edits it", async () => {
    const { user } = renderApp("/sign-in");
    await user.click(submitButton());

    await user.type(emailInput(), "e");

    // Checks our aria-invalid flag, not the browser's own validity: "e" is
    // still an invalid type="email" value, but the user is mid-correction.
    expect(emailInput()).not.toHaveAttribute("aria-invalid");
    expect(emailInput()).not.toHaveAccessibleDescription(/enter your email/i);
    expect(passwordInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("signs in, shows who is signed in, and focuses the new page heading", async () => {
    const { user } = renderApp("/sign-in");

    await signIn(user);

    const heading = await screen.findByRole("heading", { level: 1, name: "Transaction support" });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(screen.getByText(TEST_CREDENTIALS.email)).toBeInTheDocument();
    expect(screen.getByText("Engineer")).toBeInTheDocument();
  });

  it("returns the user to the page they originally asked for", async () => {
    const { user } = renderApp("/");
    await screen.findByRole("heading", { level: 1, name: "Sign in" });

    await signIn(user);

    expect(await screen.findByRole("heading", { level: 1, name: "Transaction support" })).toBeInTheDocument();
  });

  it("explains wrong credentials, keeps the email, and clears and focuses the password", async () => {
    const { user } = renderApp("/sign-in");

    await user.type(emailInput(), TEST_CREDENTIALS.email);
    await user.type(passwordInput(), "not-the-password");
    await user.click(submitButton());

    const alert = screen.getByRole("alert");
    expect(await within(alert).findByText(/don.t match an account/)).toBeInTheDocument();
    expect(emailInput()).toHaveValue(TEST_CREDENTIALS.email);
    expect(passwordInput()).toHaveValue("");
    expect(passwordInput()).toHaveFocus();
  });

  it("explains a network failure with a next step", async () => {
    server.use(http.post("*/api/auth/login", () => HttpResponse.error()));
    const { user } = renderApp("/sign-in");

    await user.type(emailInput(), TEST_CREDENTIALS.email);
    await user.type(passwordInput(), TEST_CREDENTIALS.password);
    await user.click(submitButton());

    const alert = screen.getByRole("alert");
    expect(await within(alert).findByText("Can’t reach the PaySupport API.")).toBeInTheDocument();
    expect(within(alert).getByText(/check your connection/i)).toBeInTheDocument();
  });

  it("shows progress and sends only one request when clicked repeatedly", async () => {
    let requests = 0;
    server.use(
      http.post("*/api/auth/login", async () => {
        requests += 1;
        await delay(50);
        return HttpResponse.json(loginResponseFixture);
      }),
    );
    const { user } = renderApp("/sign-in");
    await user.type(emailInput(), TEST_CREDENTIALS.email);
    await user.type(passwordInput(), TEST_CREDENTIALS.password);

    await user.click(submitButton());
    expect(submitButton()).toHaveTextContent("Signing in…");
    await user.click(submitButton());

    await screen.findByRole("button", { name: "Sign out" });
    expect(requests).toBe(1);
  });

  it("lets the user reveal the password they typed", async () => {
    const { user } = renderApp("/sign-in");
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(passwordInput()).toHaveAttribute("type", "password");
    await user.click(toggle);

    expect(passwordInput()).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("signs out and confirms it on the sign-in page", async () => {
    const { user } = renderApp("/sign-in");
    await signIn(user);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("You’ve signed out.")).toBeInTheDocument();
    expect(screen.queryByText(TEST_CREDENTIALS.email)).not.toBeInTheDocument();
  });
});
