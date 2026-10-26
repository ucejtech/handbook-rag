import { Pool } from "pg";

import { requireEnv } from "./env";

// Next.js dev mode re-runs modules on every edit. Keeping the pool on
// globalThis stops each reload from opening another set of connections.
const globalForDb = globalThis as typeof globalThis & { handbookPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.handbookPool) {
    const pool = new Pool({
      connectionString: requireEnv("DATABASE_URL"),
      max: 5,
      // Fail fast instead of hanging when the database isn't running or a
      // query gets stuck.
      connectionTimeoutMillis: 5_000,
      statement_timeout: 10_000,
    });
    // An idle connection dropping (e.g. the database restarting) would
    // otherwise crash the process.
    pool.on("error", (error) => console.error("Postgres pool error:", error.message));
    globalForDb.handbookPool = pool;
  }
  return globalForDb.handbookPool;
}

export async function closePool(): Promise<void> {
  await globalForDb.handbookPool?.end();
  globalForDb.handbookPool = undefined;
}
