import request from "supertest";

// db/pool opens a real pg Pool on import; mock it so app-level tests don't
// need a live Postgres connection just to exercise routing/middleware.
jest.mock("../src/db/pool", () => ({
  query: jest.fn(),
  pool: { on: jest.fn(), query: jest.fn() },
}));

import { createApp } from "../src/app";

const app = createApp();

describe("app", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("POST /auth/login rejects malformed input with 400", async () => {
    const res = await request(app).post("/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation_error");
  });

  it("rejects protected routes without a bearer token", async () => {
    const res = await request(app).get("/accounts");
    expect(res.status).toBe(401);
  });

  it("rejects protected routes with a garbage token", async () => {
    const res = await request(app).get("/accounts").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("404s on unknown routes", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
  });
});
