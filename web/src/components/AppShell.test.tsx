import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderApp } from "../test/renderApp";
import { server } from "../test/server";

const outageHeading = { name: /can.t reach the paysupport api/i };

describe("AppShell", () => {
  it("offers a skip link that targets the main landmark", () => {
    renderApp("/sign-in");

    const skipLink = screen.getByRole("link", { name: "Skip to main content" });
    expect(skipLink).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
  });

  it("shows a checking state, then reports the API as connected", async () => {
    renderApp("/sign-in");

    expect(screen.getByRole("status")).toHaveTextContent("Checking API…");
    expect(await screen.findByText("API connected")).toBeInTheDocument();
    expect(screen.queryByRole("heading", outageHeading)).not.toBeInTheDocument();
  });

  it("shows an outage banner when the API returns an error", async () => {
    server.use(http.get("*/api/health", () => HttpResponse.json({ error: "internal_error" }, { status: 503 })));
    renderApp("/sign-in");

    expect(await screen.findByRole("heading", outageHeading)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("API unavailable");
    expect(screen.getByText(/last checked at/i)).toBeInTheDocument();
  });

  it("treats a network failure as unavailable", async () => {
    server.use(http.get("*/api/health", () => HttpResponse.error()));
    renderApp("/sign-in");

    expect(await screen.findByRole("heading", outageHeading)).toBeInTheDocument();
  });

  it("treats a response that fails validation as unavailable", async () => {
    server.use(http.get("*/api/health", () => HttpResponse.json({ status: "degraded" })));
    renderApp("/sign-in");

    expect(await screen.findByRole("heading", outageHeading)).toBeInTheDocument();
  });

  it("recovers when the user checks again after the API comes back", async () => {
    server.use(http.get("*/api/health", () => HttpResponse.error()));
    const { user } = renderApp("/sign-in");
    await screen.findByRole("heading", outageHeading);

    // Drop the failing override so the default healthy handler answers.
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Check now" }));

    expect(await screen.findByText("API connected")).toBeInTheDocument();
    expect(screen.queryByRole("heading", outageHeading)).not.toBeInTheDocument();
  });

  it("explains an unknown address and links back home", () => {
    renderApp("/no-such-page");

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to transaction support" })).toHaveAttribute("href", "/");
  });
});
