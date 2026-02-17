import { getCoreHealth } from "@kwielford/core";
export * from "./cli.js";

export function getCliHealth() {
  return {
    service: "cli",
    ...getCoreHealth()
  };
}
