import { getCoreHealth } from "@kweilford/core";
export * from "./adapters/slack-web-api.js";
export * from "./flows/thread-summary-flow.js";
export * from "./parsers/slash-command.js";
export * from "./security/verify-slack-signature.js";

export function getSlackHealth() {
  return {
    service: "slack",
    ...getCoreHealth()
  };
}
