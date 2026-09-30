import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

if (!hasDatabaseUrl) {
  console.warn(
    "[WARN] DATABASE_URL is not set. Database operations will safely fall back to the in-memory store.",
  );
}

export const pool = hasDatabaseUrl
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : (null as unknown as pg.Pool);

export const db = hasDatabaseUrl
  ? drizzle(pool, { schema })
  : (null as unknown as ReturnType<typeof drizzle<typeof schema>>);

export * from "./schema";
