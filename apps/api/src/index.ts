import { getCoreHealth } from "@kweilford/core";
export * from "./adapters/vercel-workflow-thread-summary-dispatcher.js";
export * from "./routes/slack-thread-summary-command.js";
export * from "./vercel-routes/slack-thread-summary-command.js";
export * from "./workflows/thread-summary-workflow.js";

export function getApiHealth() {
  return {
    service: "api",
    ...getCoreHealth()
  };
}
