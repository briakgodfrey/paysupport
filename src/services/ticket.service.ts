import { query } from "../db/pool";
import { SupportTicket } from "../types";
import { ApiError } from "../middleware/errorHandler";

export async function listTickets(status: string | undefined, limit: number, offset: number): Promise<SupportTicket[]> {
  if (status) {
    const { rows } = await query<SupportTicket>(
      `SELECT * FROM support_tickets WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    return rows;
  }
  const { rows } = await query<SupportTicket>(
    `SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function getTicketById(id: string): Promise<SupportTicket> {
  const { rows } = await query<SupportTicket>(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
  if (!rows[0]) throw new ApiError(404, "not_found", `No ticket with id ${id}`);
  return rows[0];
}

export async function createTicket(input: {
  accountId: string;
  transactionId?: string | null;
  subject: string;
  description?: string;
}): Promise<SupportTicket> {
  const { rows } = await query<SupportTicket>(
    `INSERT INTO support_tickets (account_id, transaction_id, subject, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.accountId, input.transactionId ?? null, input.subject, input.description ?? null]
  );
  return rows[0];
}

export async function updateTicket(
  id: string,
  updates: { status?: SupportTicket["status"]; assignedTo?: string | null }
): Promise<SupportTicket> {
  await getTicketById(id); // 404s if missing

  const resolvedAtClause = updates.status === "resolved" ? `, resolved_at = now()` : "";
  const { rows } = await query<SupportTicket>(
    `UPDATE support_tickets
     SET status = COALESCE($2, status),
         assigned_to = COALESCE($3, assigned_to)
         ${resolvedAtClause}
     WHERE id = $1
     RETURNING *`,
    [id, updates.status ?? null, updates.assignedTo ?? null]
  );
  return rows[0];
}
