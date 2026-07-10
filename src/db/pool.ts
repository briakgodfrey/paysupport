import { Pool, QueryResult, QueryResultRow, types } from "pg";
import { env } from "../config/env";

// node-postgres returns BIGINT columns (oid 20) as strings by default, to
// avoid silent precision loss above Number.MAX_SAFE_INTEGER. Our amounts
// are cents values that never approach that range, so we parse them as
// numbers -- otherwise equality checks like "500000" !== 500000 break
// things like the reconciliation engine's amount comparison.
types.setTypeParser(20, (val: string) => parseInt(val, 10));

// Single shared pool for the process. All data access in this project goes
// through raw parameterized SQL via this pool -- no ORM -- so query shape
// and joins are explicit and reviewable.
export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[db] unexpected error on idle client", err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const durationMs = Date.now() - start;
  if (durationMs > 200) {
    // eslint-disable-next-line no-console
    console.warn(`[db] slow query (${durationMs}ms): ${text.slice(0, 120)}`);
  }
  return result;
}
