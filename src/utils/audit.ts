import { query } from "../db/pool";

/**
 * Every mutating action and every diagnostic lookup writes an audit row.
 * This is the backbone of "how did we get here" investigations -- exactly
 * the kind of trail a support engineer relies on when reconstructing what
 * happened to a customer's money.
 */
export async function recordAudit(
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: unknown
): Promise<void> {
  await query(
    `INSERT INTO audit_log (actor, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [actor, action, entityType, entityId, details ? JSON.stringify(details) : null]
  );
}
