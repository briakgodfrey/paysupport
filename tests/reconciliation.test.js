"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("../src/db/pool");
const vendor_client_1 = require("../src/services/vendor.client");
const reconciliation_service_1 = require("../src/services/reconciliation.service");
jest.mock("../src/db/pool", () => ({
    query: jest.fn(),
}));
jest.mock("../src/services/vendor.client", () => ({
    getVendorTransaction: jest.fn(),
    createVendorTransaction: jest.fn(),
}));
const mockedQuery = pool_1.query;
const mockedGetVendorTransaction = vendor_client_1.getVendorTransaction;
const baseRow = {
    id: "t-1",
    account_id: "a-1",
    card_id: null,
    type: "card_purchase",
    amount_cents: 5000,
    status: "settled",
    vendor_ref_id: "vtx_1",
    vendor_status: "settled",
    created_at: new Date().toISOString(),
    customer_name: "Jane Doe",
    account_email: "jane@example.com",
    card_last4: null,
    card_network: null,
};
describe("diagnoseTransaction", () => {
    beforeEach(() => jest.clearAllMocks());
    it("returns 'match' when internal and vendor records agree", async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [baseRow] });
        mockedGetVendorTransaction.mockResolvedValueOnce({
            found: true,
            transaction: { vendorRefId: "vtx_1", status: "settled", amountCents: 5000, network: "visa", updatedAt: new Date().toISOString() },
        });
        const report = await (0, reconciliation_service_1.diagnoseTransaction)("t-1");
        expect(report.outcome).toBe("match");
    });
    it("flags a status_mismatch when vendor status differs from internal status", async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [{ ...baseRow, status: "pending" }] });
        mockedGetVendorTransaction.mockResolvedValueOnce({
            found: true,
            transaction: { vendorRefId: "vtx_1", status: "settled", amountCents: 5000, network: "visa", updatedAt: new Date().toISOString() },
        });
        const report = await (0, reconciliation_service_1.diagnoseTransaction)("t-1");
        expect(report.outcome).toBe("status_mismatch");
        expect(report.notes).toMatch(/stale/i);
    });
    it("flags an amount_mismatch when vendor amount differs from internal amount", async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [baseRow] });
        mockedGetVendorTransaction.mockResolvedValueOnce({
            found: true,
            transaction: { vendorRefId: "vtx_1", status: "settled", amountCents: 5050, network: "visa", updatedAt: new Date().toISOString() },
        });
        const report = await (0, reconciliation_service_1.diagnoseTransaction)("t-1");
        expect(report.outcome).toBe("amount_mismatch");
    });
    it("returns vendor_not_found when the vendor has no record", async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [baseRow] });
        mockedGetVendorTransaction.mockResolvedValueOnce({ found: false, reason: "not_found" });
        const report = await (0, reconciliation_service_1.diagnoseTransaction)("t-1");
        expect(report.outcome).toBe("vendor_not_found");
    });
    it("returns no_vendor_ref when the transaction has no vendor reference", async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [{ ...baseRow, vendor_ref_id: null }] });
        const report = await (0, reconciliation_service_1.diagnoseTransaction)("t-1");
        expect(report.outcome).toBe("no_vendor_ref");
        expect(mockedGetVendorTransaction).not.toHaveBeenCalled();
    });
    it("throws a 404 ApiError when the transaction does not exist", async () => {
        mockedQuery.mockResolvedValueOnce({ rows: [] });
        await expect((0, reconciliation_service_1.diagnoseTransaction)("missing")).rejects.toMatchObject({ status: 404 });
    });
});
//# sourceMappingURL=reconciliation.test.js.map