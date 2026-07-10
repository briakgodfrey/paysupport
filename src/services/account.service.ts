import { query } from "../db/pool";
import { Account, Transaction } from "../types";
import { ApiError } from "../middleware/errorHandler";

export async function listAccounts(limit: number, offset: number): Promise<Account[]> {
  const { rows } = await query<Account>(
    `SELECT * FROM accounts ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function getAccountById(id: string): Promise<Account> {
  const { rows } = await query<Account>(`SELECT * FROM accounts WHERE id = $1`, [id]);
  if (!rows[0]) throw new ApiError(404, "not_found", `No account with id ${id}`);
  return rows[0];
}

export async function createAccount(input: {
  customerName: string;
  email: string;
  accountType: Account["account_type"];
}): Promise<Account> {
  const { rows } = await query<Account>(
    `INSERT INTO accounts (customer_name, email, account_type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.customerName, input.email, input.accountType]
  );
  return rows[0];
}

/**
 * Account + transaction history in one call -- a support engineer looking
 * at a customer's account needs the transaction list right alongside it,
 * not a second round trip.
 */
export async function getAccountTransactions(accountId: string, limit: number, offset: number): Promise<Transaction[]> {
  await getAccountById(accountId); // 404s if missing
  const { rows } = await query<Transaction>(
    `SELECT * FROM transactions
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [accountId, limit, offset]
  );
  return rows;
}
