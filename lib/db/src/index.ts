import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fail fast instead of hanging — requests return an error in < 5s if DB is down
  connectionTimeoutMillis: 5_000,
  // Kill queries that run longer than 30s
  statement_timeout: 30_000,
  // Release idle connections after 30s
  idleTimeoutMillis: 30_000,
  // Allow up to 20 parallel connections
  max: 20,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
