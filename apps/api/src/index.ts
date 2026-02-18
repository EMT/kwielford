import { getCoreHealth } from "@kwielford/core";

export * from "./routes/slack-assistant-events.js";

export function getApiHealth() {
  return {
    service: "api",
    ...getCoreHealth()
  };
}
