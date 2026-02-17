import type { ThreadSummaryOutput } from "@kwielford/core";

export function formatThreadSummaryForSlack(output: ThreadSummaryOutput): string {
  const lines = [
    "*Thread Summary*",
    output.summary,
    "",
    "*Decisions*",
    ...(output.decisions.length > 0 ? output.decisions.map((item) => `• ${item}`) : ["• None captured"]),
    "",
    "*Blockers*",
    ...(output.blockers.length > 0 ? output.blockers.map((item) => `• ${item}`) : ["• None captured"]),
    "",
    "*Next Actions*",
    ...(output.nextActions.length > 0 ? output.nextActions.map((item) => `• ${item}`) : ["• None captured"])
  ];

  return lines.join("\n");
}
