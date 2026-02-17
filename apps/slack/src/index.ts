import { getCoreHealth } from "@kwielford/core";
export * from "./adapters/slack-web-api.js";
export * from "./formatters/thread-summary.js";
export * from "./parsers/slash-command.js";
export * from "./security/verify-slack-signature.js";

export function getSlackHealth() {
  return {
    service: "slack",
    ...getCoreHealth()
  };
}
