import request from "supertest";
import jwt from "jsonwebtoken";

// db/pool opens a real pg Pool on import; mock it so these tests only
// exercise routing and validation.
jest.mock("../src/db/pool", () => ({
  query: jest.fn(),
  pool: { on: jest.fn(), query: jest.fn() },
}));

import { query } from "../src/db/pool";
import { createApp } from "../src/app";

const app = createApp();
const mockedQuery = query as jest.MockedFunction<typeof query>;

// tests/setup.ts sets JWT_SECRET to "test-secret".
const token = jwt.sign(
  { id: "11111111-1111-1111-1111-111111111111", email: "admin@paysupport.dev", role: "admin" },
  "test-secret"
);
const auth = { Authorization: `Bearer ${token}` };

// A real seed ID. Its version nibble is 0, so a strict RFC 4122 check would reject it.
const SEED_TRANSACTION_ID = "e1111111-0000-0000-0000-000000000002";

beforeEach(() => {
  mockedQuery.mockReset();
});

describe("id path parameters", () => {
  it.each([
    ["GET", "/transactions/not-a-uuid"],
    ["GET", "/transactions/not-a-uuid/diagnose"],
    ["GET", "/transactions/t1111111-0000-0000-0000-000000000002/diagnose"],
    ["GET", "/accounts/123"],
    ["GET", "/accounts/123/transactions"],
    ["GET", "/tickets/abc"],
    ["PATCH", "/tickets/abc"],
  ])("%s %s rejects a malformed id with 400 before touching the database", async (method, path) => {
    const req = method === "PATCH" ? request(app).patch(path).send({ status: "resolved" }) : request(app).get(path);
    const res = await req.set(auth);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "validation_error", message: "id: must be a UUID" });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("accepts a seed-style id and returns 404 when it doesn't exist", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(app).get(`/transactions/${SEED_TRANSACTION_ID}/diagnose`).set(auth);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("still requires authentication before validating the id", async () => {
    const res = await request(app).get("/transactions/not-a-uuid/diagnose");

    expect(res.status).toBe(401);
  });
});
