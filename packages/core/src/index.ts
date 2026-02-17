import { getRuntimeConfig } from "@kweilford/config";
import { getDbHealth } from "@kweilford/db";
export * from "./tasks/thread-summary.js";

export interface CoreHealth {
  env: string;
  dbMessage: string;
}

export function getCoreHealth(): CoreHealth {
  const config = getRuntimeConfig();
  const db = getDbHealth();

  return {
    env: config.appEnv,
    dbMessage: db.message
  };
}
