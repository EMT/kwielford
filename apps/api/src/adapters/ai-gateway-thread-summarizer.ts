import type { ThreadSummaryInput, ThreadSummaryOutput } from "@kwielford/core";

export interface AiGatewayThreadSummarizerConfig {
  apiKey: string;
  model: string;
  baseURL: string;
  timeoutMs: number;
}

interface JsonObject {
  [key: string]: unknown;
}

interface GenerateTextResponse {
  text: string;
}

type GenerateTextFn = (input: {
  model: unknown;
  prompt: string;
  abortSignal?: AbortSignal;
}) => Promise<GenerateTextResponse>;

type CreateOpenAIFn = (options: {
  apiKey: string;
  baseURL: string;
}) => (model: string) => unknown;

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

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const values = value
    .map((item) => (typeof item === "string" ? normalizeText(item) : ""))
    .filter((item) => item.length > 0)
    .map((item) => truncate(item, 180));

  return dedupe(values).slice(0, 5);
}

function defaultSummaryFromMessages(input: ThreadSummaryInput): string {
  const tail = input.messages
    .slice(-3)
    .map((message) => normalizeText(message.text))
    .filter((message) => message.length > 0)
    .map((message) => truncate(message, 180));

  return tail.length > 0 ? tail.join(" ") : "No thread content was available to summarize.";
}

function toSummaryOutput(input: ThreadSummaryInput, payload: JsonObject): ThreadSummaryOutput {
  const summary =
    typeof payload.summary === "string" && normalizeText(payload.summary).length > 0
      ? truncate(normalizeText(payload.summary), 600)
      : defaultSummaryFromMessages(input);

  return {
    summary,
    decisions: coerceStringArray(payload.decisions),
    blockers: coerceStringArray(payload.blockers),
    nextActions: coerceStringArray(payload.nextActions)
  };
}

function parseJsonObject(raw: string): JsonObject | undefined {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    return parsed as JsonObject;
  } catch {
    return undefined;
  }
}

function extractFirstJsonObject(raw: string): JsonObject | undefined {
  const direct = parseJsonObject(raw);
  if (direct) {
    return direct;
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return undefined;
  }

  return parseJsonObject(raw.slice(start, end + 1));
}

async function loadAiSdk(): Promise<{ generateText: GenerateTextFn; createOpenAI: CreateOpenAIFn }> {
  const aiModuleName = "ai";
  const openAiModuleName = "@ai-sdk/openai";
  const [aiModule, openAiModule] = await Promise.all([import(aiModuleName), import(openAiModuleName)]);

  const generateText = (aiModule as { generateText?: GenerateTextFn }).generateText;
  const createOpenAI = (openAiModule as { createOpenAI?: CreateOpenAIFn }).createOpenAI;

  if (typeof generateText !== "function") {
    throw new Error("AI SDK missing generateText export");
  }

  if (typeof createOpenAI !== "function") {
    throw new Error("AI SDK OpenAI provider missing createOpenAI export");
  }

  return {
    generateText,
    createOpenAI
  };
}

function toPrompt(input: ThreadSummaryInput): string {
  const messages = input.messages
    .slice(-120)
    .map((message, index) => {
      const userId = message.userId ? `<${message.userId}>` : "<unknown>";
      const text = truncate(normalizeText(message.text), 500);
      return `${index + 1}. [${message.ts}] ${userId} ${text}`;
    })
    .join("\n");

  return [
    "You summarize Slack threads for engineering teams.",
    "Return ONLY valid JSON (no markdown, no prose) with this exact shape:",
    '{"summary":"string","decisions":["string"],"blockers":["string"],"nextActions":["string"]}',
    "Rules:",
    "- summary: 1-3 sentences",
    "- decisions, blockers, nextActions: max 5 items each",
    "- Keep each list item <= 180 characters",
    "- If no items exist for a list, return []",
    "",
    `Thread channel: ${input.channelId}`,
    `Thread timestamp: ${input.threadTs}`,
    "Messages:",
    messages.length > 0 ? messages : "No messages were provided."
  ].join("\n");
}

export async function summarizeThreadWithAiGateway(
  input: ThreadSummaryInput,
  config: AiGatewayThreadSummarizerConfig
): Promise<ThreadSummaryOutput> {
  if (!config.apiKey) {
    throw new Error("AI Gateway API key is missing");
  }

  const { generateText, createOpenAI } = await loadAiSdk();
  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL
  });
  const model = provider(config.model);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), config.timeoutMs);

  try {
    const response = await generateText({
      model,
      prompt: toPrompt(input),
      abortSignal: abortController.signal
    });
    const payload = extractFirstJsonObject(response.text);

    if (!payload) {
      throw new Error("Model response was not valid JSON");
    }

    return toSummaryOutput(input, payload);
  } finally {
    clearTimeout(timeout);
  }
}
