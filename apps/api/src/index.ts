import { getCoreHealth } from "@kwielford/core";

export * from "./adapters/vercel-workflow-assistant-event-dispatcher.js";
export * from "./routes/slack-assistant-events.js";
export * from "./workflows/slack-assistant-event-workflow.js";

export function getApiHealth() {
  return {
    service: "api",
    ...getCoreHealth()
  };
}
