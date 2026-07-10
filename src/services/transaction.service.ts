import { query } from "../db/pool";
import { Transaction } from "../types";
import { ApiError } from "../middleware/errorHandler";
import { createVendorTransaction } from "./vendor.client";
import { getAccountById } from "./account.service";

const NETWORK_BY_TYPE: Record<string, string> = {
  card_purchase: "visa",
  ach_credit: "ach",
  ach_debit: "ach",
  transfer: "internal",
};

export async function getTransactionById(id: string): Promise<Transaction> {
  const { rows } = await query<Transaction>(`SELECT * FROM transactions WHERE id = $1`, [id]);
  if (!rows[0]) throw new ApiError(404, "not_found", `No transaction with id ${id}`);
  return rows[0];
}

/**
 * Creates a transaction, registers it with the vendor (except pure internal
 * transfers), and stores the returned vendor_ref_id/vendor_status. This is
 * the write path that /diagnose and the reconciliation engine later verify.
 */
export async function createTransaction(input: {
  accountId: string;
  cardId?: string | null;
  type: Transaction["type"];
  amountCents: number;
  description?: string;
}): Promise<Transaction> {
  const account = await getAccountById(input.accountId);
  if (account.status !== "active") {
    throw new ApiError(422, "account_not_active", `Account ${account.id} is ${account.status}`);
  }

  let vendorRefId: string | null = null;
  let vendorStatus: string | null = null;

  if (input.type !== "transfer") {
    const network = NETWORK_BY_TYPE[input.type] ?? "unknown";
    const vendorTx = await createVendorTransaction(input.amountCents, network);
    vendorRefId = vendorTx.vendorRefId;
    vendorStatus = vendorTx.status;
  }

  const { rows } = await query<Transaction>(
    `INSERT INTO transactions (account_id, card_id, type, amount_cents, status, vendor_ref_id, vendor_status, description)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
     RETURNING *`,
    [input.accountId, input.cardId ?? null, input.type, input.amountCents, vendorRefId, vendorStatus, input.description ?? null]
  );

  return rows[0];
}

export async function listTransactions(filters: {
  status?: string;
  limit: number;
  offset: number;
}): Promise<Transaction[]> {
  if (filters.status) {
    const { rows } = await query<Transaction>(
      `SELECT * FROM transactions WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [filters.status, filters.limit, filters.offset]
    );
    return rows;
  }
  const { rows } = await query<Transaction>(
    `SELECT * FROM transactions ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [filters.limit, filters.offset]
  );
  return rows;
}
