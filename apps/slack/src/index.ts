import { getCoreHealth } from "@kwielford/core";

export * from "./adapters/slack-web-api.js";
export * from "./inbound/assistant-events-handler.js";
export * from "./security/verify-slack-signature.js";

export function getSlackHealth() {
  return {
    service: "slack",
    ...getCoreHealth()
  };
}
