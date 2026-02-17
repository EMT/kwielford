export * from "./client.js";
export * from "./repositories.js";
export * from "./seed.js";
export * from "./schema.js";

export interface DbHealth {
  ok: true;
  message: string;
  tables: string[];
}

export function getDbHealth(): DbHealth {
  return {
    ok: true,
    message: "db package initialized",
    tables: ["workspaces", "users", "agent_tasks", "agent_runs", "messages", "audit_events"]
  };
}
