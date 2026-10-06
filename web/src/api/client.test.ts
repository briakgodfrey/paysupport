import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { server } from "../test/server";
import { TEST_TOKEN } from "../test/fixtures";
import { createApiClient } from "./client";

/*
 * Exercises the client against a throwaway endpoint, so these tests cover
 * transport behaviour (headers, status mapping, timeouts, validation)
 * independently of any real endpoint's schema.
 */

const THING_URL = "*/api/thing";
const thingSchema = z.object({ name: z.string() });

function getThing(client = createApiClient(), options: { timeoutMs?: number; signal?: AbortSignal } = {}) {
  return client.request({ method: "GET", path: "/thing", schema: thingSchema, ...options });
}

describe("createApiClient", () => {
  it("returns validated data on success", async () => {
    server.use(http.get(THING_URL, () => HttpResponse.json({ name: "ledger" })));

    await expect(getThing()).resolves.toEqual({ ok: true, data: { name: "ledger" } });
  });

  it("drops fields the schema doesn't declare", async () => {
    server.use(http.get(THING_URL, () => HttpResponse.json({ name: "ledger", internalSecret: "x" })));

    await expect(getThing()).resolves.toEqual({ ok: true, data: { name: "ledger" } });
  });

  it("sends the bearer token when a session exists", async () => {
    let authHeader: string | null = null;
    server.use(
      http.get(THING_URL, ({ request }) => {
        authHeader = request.headers.get("Authorization");
        return HttpResponse.json({ name: "ledger" });
      }),
    );

    await getThing(createApiClient({ getToken: () => TEST_TOKEN }));

    expect(authHeader).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it("sends no Authorization header when signed out", async () => {
    let hasAuthHeader = true;
    server.use(
      http.get(THING_URL, ({ request }) => {
        hasAuthHeader = request.headers.has("Authorization");
        return HttpResponse.json({ name: "ledger" });
      }),
    );

    await getThing(createApiClient({ getToken: () => null }));

    expect(hasAuthHeader).toBe(false);
  });

  it("sends POST bodies as JSON", async () => {
    let received: unknown = null;
    let contentType: string | null = null;
    server.use(
      http.post(THING_URL, async ({ request }) => {
        contentType = request.headers.get("Content-Type");
        received = await request.json();
        return HttpResponse.json({ name: "created" });
      }),
    );

    await createApiClient().request({ method: "POST", path: "/thing", schema: thingSchema, body: { name: "new" } });

    expect(contentType).toBe("application/json");
    expect(received).toEqual({ name: "new" });
  });

  it.each<{ status: number; kind: string }>([
    { status: 400, kind: "validation" },
    { status: 403, kind: "forbidden" },
    { status: 404, kind: "not_found" },
    { status: 422, kind: "unexpected_status" },
    { status: 500, kind: "server" },
    { status: 502, kind: "server" },
    { status: 503, kind: "server" },
  ])("maps HTTP $status to a $kind failure", async ({ status, kind }) => {
    server.use(http.get(THING_URL, () => HttpResponse.json({ error: "some_error" }, { status })));

    await expect(getThing()).resolves.toMatchObject({ ok: false, error: { kind } });
  });

  it("keeps the API's error body as detail", async () => {
    server.use(
      http.get(THING_URL, () =>
        HttpResponse.json({ error: "forbidden", message: "Requires role: engineer or admin" }, { status: 403 }),
      ),
    );

    await expect(getThing()).resolves.toEqual({
      ok: false,
      error: { kind: "forbidden", detail: { error: "forbidden", message: "Requires role: engineer or admin" } },
    });
  });

  it("still reports the status when the error body isn't JSON", async () => {
    server.use(http.get(THING_URL, () => new HttpResponse("<h1>Bad Gateway</h1>", { status: 502 })));

    await expect(getThing()).resolves.toEqual({
      ok: false,
      error: { kind: "server", status: 502, detail: null },
    });
  });

  it("ends the session when a request with a token gets a 401", async () => {
    const onUnauthorized = vi.fn();
    server.use(http.get(THING_URL, () => HttpResponse.json({ error: "unauthorized" }, { status: 401 })));

    const result = await getThing(createApiClient({ getToken: () => TEST_TOKEN, onUnauthorized }));

    expect(result).toMatchObject({ ok: false, error: { kind: "unauthorized" } });
    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith(TEST_TOKEN);
  });

  it("does not end a session on a 401 without a token, such as a failed sign-in", async () => {
    const onUnauthorized = vi.fn();
    server.use(http.get(THING_URL, () => HttpResponse.json({ error: "invalid_credentials" }, { status: 401 })));

    const result = await getThing(createApiClient({ getToken: () => null, onUnauthorized }));

    expect(result).toMatchObject({ ok: false, error: { kind: "unauthorized" } });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("reports a network failure", async () => {
    server.use(http.get(THING_URL, () => HttpResponse.error()));

    await expect(getThing()).resolves.toEqual({ ok: false, error: { kind: "network" } });
  });

  it("reports a 2xx body that isn't JSON as invalid_response", async () => {
    server.use(http.get(THING_URL, () => new HttpResponse("not json", { status: 200 })));

    await expect(getThing()).resolves.toEqual({ ok: false, error: { kind: "invalid_response" } });
  });

  it("reports a body that fails the schema as invalid_response", async () => {
    server.use(http.get(THING_URL, () => HttpResponse.json({ name: 42 })));

    await expect(getThing()).resolves.toEqual({ ok: false, error: { kind: "invalid_response" } });
  });

  it("reports a timeout when the API is too slow", async () => {
    server.use(
      http.get(THING_URL, async () => {
        await delay(500);
        return HttpResponse.json({ name: "too late" });
      }),
    );

    await expect(getThing(createApiClient(), { timeoutMs: 20 })).resolves.toEqual({
      ok: false,
      error: { kind: "timeout" },
    });
  });

  it("reports a cancelled request as aborted", async () => {
    server.use(
      http.get(THING_URL, async () => {
        await delay(500);
        return HttpResponse.json({ name: "too late" });
      }),
    );
    const controller = new AbortController();

    const pending = getThing(createApiClient(), { signal: controller.signal });
    controller.abort();

    await expect(pending).resolves.toEqual({ ok: false, error: { kind: "aborted" } });
  });
});
