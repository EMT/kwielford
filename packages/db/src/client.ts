import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema.js";

function getDatabaseUrl(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL environment variable.");
  }

  return databaseUrl;
}

export function createDb(url = getDatabaseUrl()) {
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export type DbClient = ReturnType<typeof createDb>;
