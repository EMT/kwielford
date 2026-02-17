import { defineConfig } from "drizzle-kit";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const databaseUrl = env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl
  }
});
