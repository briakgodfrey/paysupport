"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
// db/pool opens a real pg Pool on import; mock it so app-level tests don't
// need a live Postgres connection just to exercise routing/middleware.
jest.mock("../src/db/pool", () => ({
    query: jest.fn(),
    pool: { on: jest.fn(), query: jest.fn() },
}));
const app_1 = require("../src/app");
const app = (0, app_1.createApp)();
describe("app", () => {
    it("GET /health returns ok", async () => {
        const res = await (0, supertest_1.default)(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
    });
    it("POST /auth/login rejects malformed input with 400", async () => {
        const res = await (0, supertest_1.default)(app).post("/auth/login").send({ email: "not-an-email" });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("validation_error");
    });
    it("rejects protected routes without a bearer token", async () => {
        const res = await (0, supertest_1.default)(app).get("/accounts");
        expect(res.status).toBe(401);
    });
    it("rejects protected routes with a garbage token", async () => {
        const res = await (0, supertest_1.default)(app).get("/accounts").set("Authorization", "Bearer not-a-real-token");
        expect(res.status).toBe(401);
    });
    it("404s on unknown routes", async () => {
        const res = await (0, supertest_1.default)(app).get("/nope");
        expect(res.status).toBe(404);
    });
});
//# sourceMappingURL=app.test.js.map