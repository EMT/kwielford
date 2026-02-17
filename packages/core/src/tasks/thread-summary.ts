export interface ThreadMessage {
  ts: string;
  userId?: string;
  text: string;
}

export interface ThreadSummaryInput {
  channelId: string;
  threadTs: string;
  messages: ThreadMessage[];
}

export interface ThreadSummaryOutput {
  summary: string;
  decisions: string[];
  blockers: string[];
  nextActions: string[];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of items) {
    const normalized = normalizeText(item).toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    out.push(item);
  }

  return out;
}

function pickByPattern(messages: ThreadMessage[], pattern: RegExp): string[] {
  return messages
    .map((message) => normalizeText(message.text))
    .filter((text) => pattern.test(text))
    .map((text) => truncate(text, 180));
}

export function summarizeThread(input: ThreadSummaryInput): ThreadSummaryOutput {
  const cleanedMessages = input.messages
    .map((message) => ({
      ...message,
      text: normalizeText(message.text)
    }))
    .filter((message) => message.text.length > 0);

  const decisions = dedupe(
    pickByPattern(cleanedMessages, /\b(decision|decided|approved|ship it|go ahead|agreed)\b/i)
  ).slice(0, 5);

  const blockers = dedupe(
    pickByPattern(cleanedMessages, /\b(blocked|blocker|risk|issue|concern|dependency)\b/i)
  ).slice(0, 5);

  const nextActions = dedupe(
    pickByPattern(cleanedMessages, /\b(todo|action|next step|follow up|owner)\b/i)
  ).slice(0, 5);

  const topLines = cleanedMessages.slice(-5).map((message) => truncate(message.text, 150));
  const defaultSummary = topLines.length > 0 ? topLines.join(" ") : "No thread content was available to summarize.";

  const summaryBits: string[] = [];
  if (decisions.length > 0) {
    summaryBits.push(`Decisions captured: ${decisions.length}.`);
  }
  if (blockers.length > 0) {
    summaryBits.push(`Blockers captured: ${blockers.length}.`);
  }
  if (nextActions.length > 0) {
    summaryBits.push(`Follow-ups captured: ${nextActions.length}.`);
  }

  const summaryPrefix = summaryBits.join(" ");

  return {
    summary: summaryPrefix ? `${summaryPrefix} ${defaultSummary}` : defaultSummary,
    decisions,
    blockers,
    nextActions
  };
}

export function formatThreadSummaryText(output: ThreadSummaryOutput): string {
  const lines = [
    "Thread Summary",
    output.summary,
    "",
    "Decisions",
    ...(output.decisions.length > 0 ? output.decisions.map((item) => `- ${item}`) : ["- None captured"]),
    "",
    "Blockers",
    ...(output.blockers.length > 0 ? output.blockers.map((item) => `- ${item}`) : ["- None captured"]),
    "",
    "Next Actions",
    ...(output.nextActions.length > 0 ? output.nextActions.map((item) => `- ${item}`) : ["- None captured"])
  ];

  return lines.join("\n");
}
