import { getCoreHealth } from "@kweilford/core";
export * from "./cli.js";

export function getCliHealth() {
  return {
    service: "cli",
    ...getCoreHealth()
  };
}
