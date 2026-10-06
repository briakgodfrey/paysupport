import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { loginResponseFixture, TEST_CREDENTIALS, TEST_TOKEN } from "../test/fixtures";
import { server } from "../test/server";
import { SessionProvider, useSession } from "./SessionContext";

/*
 * Session rules tested through a small probe component, so the tests can
 * make authenticated requests without depending on any real page.
 */

const SECOND_TOKEN = "second-header.second-payload.second-signature";

function Probe() {
  const { user, endReason, api, signIn, signOut } = useSession();
  const [lastLoad, setLastLoad] = useState("none");

  return (
    <>
      <p>User: {user?.email ?? "signed out"}</p>
      <p>Ended: {endReason ?? "no"}</p>
      <p>Last load: {lastLoad}</p>
      <button
        type="button"
        onClick={() => {
          void signIn(TEST_CREDENTIALS);
        }}
      >
        Sign in
      </button>
      <button type="button" onClick={signOut}>
        Sign out
      </button>
      <button
        type="button"
        onClick={() => {
          void api.listDiscrepancies().then((result) => {
            setLastLoad(result.ok ? "ok" : result.error.kind);
          });
        }}
      >
        Load
      </button>
    </>
  );
}

function renderProbe() {
  const user = userEvent.setup();
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
  return user;
}

describe("SessionProvider", () => {
  it("attaches the token to API requests after sign-in", async () => {
    let authHeader: string | null = null;
    server.use(
      http.get("*/api/reconciliation/discrepancies", ({ request }) => {
        authHeader = request.headers.get("Authorization");
        return HttpResponse.json({ discrepancies: [] });
      }),
    );
    const user = renderProbe();

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText(`User: ${TEST_CREDENTIALS.email}`);
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(await screen.findByText("Last load: ok")).toBeInTheDocument();
    expect(authHeader).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it("forgets the token on sign-out", async () => {
    const user = renderProbe();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText(`User: ${TEST_CREDENTIALS.email}`);

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(screen.getByText("Ended: signed_out")).toBeInTheDocument();
    // The default handler rejects requests without the test token.
    expect(await screen.findByText("Last load: unauthorized")).toBeInTheDocument();
  });

  it("ends the session as expired when the API rejects the token", async () => {
    server.use(
      http.get("*/api/reconciliation/discrepancies", () =>
        HttpResponse.json({ error: "unauthorized", message: "Invalid or expired token" }, { status: 401 }),
      ),
    );
    const user = renderProbe();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText(`User: ${TEST_CREDENTIALS.email}`);

    await user.click(screen.getByRole("button", { name: "Load" }));

    expect(await screen.findByText("Ended: expired")).toBeInTheDocument();
    expect(screen.getByText("User: signed out")).toBeInTheDocument();
  });

  it("ignores a late 401 from a previous session", async () => {
    let logins = 0;
    server.use(
      http.post("*/api/auth/login", () => {
        logins += 1;
        return HttpResponse.json({ ...loginResponseFixture, token: logins === 1 ? TEST_TOKEN : SECOND_TOKEN });
      }),
      // Long enough that the user signs out and back in before this answers.
      http.get("*/api/reconciliation/discrepancies", async () => {
        await delay(300);
        return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
      }),
    );
    const user = renderProbe();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText(`User: ${TEST_CREDENTIALS.email}`);

    // Start a slow request with the first token, then switch sessions before it answers.
    await user.click(screen.getByRole("button", { name: "Load" }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText(`User: ${TEST_CREDENTIALS.email}`);

    await screen.findByText("Last load: unauthorized");
    expect(screen.getByText(`User: ${TEST_CREDENTIALS.email}`)).toBeInTheDocument();
    expect(screen.getByText("Ended: no")).toBeInTheDocument();
  });
});
