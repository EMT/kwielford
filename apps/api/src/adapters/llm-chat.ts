import type { AssistantReplyGenerator, AssistantReplyInput } from "@kwielford/slack";

export interface LlmChatConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  temperature: number;
}

interface OpenAiChatCompletionChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

interface OpenAiChatCompletionResponse {
  choices?: OpenAiChatCompletionChoice[];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function asOpenAiContent(value: unknown): string {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (Array.isArray(value)) {
    const text = value
      .map((item) => (item && typeof item === "object" && typeof item.text === "string" ? item.text : ""))
      .join(" ");
    return normalizeText(text);
  }

  return "";
}

function buildSystemPrompt(): string {
  return [
    "You are Kwielford, an assistant helping an engineering/product team improve Kwielford.",
    "Primary objectives:",
    "1) Help the team decide what to build next to improve Kwielford.",
    "2) Help the team incrementally expand Kwielford access across channels and tools.",
    "Response style:",
    "- Be concrete and implementation-focused.",
    "- Use concise lists when helpful.",
    "- If information is missing, ask 1-2 clarifying questions.",
    "- Avoid generic advice; prioritize practical next steps."
  ].join("\n");
}

function buildHistoryContext(input: AssistantReplyInput): string {
  const recent = input.threadMessages
    .slice(-12)
    .map((message) => {
      const actor = message.userId ? `user:${message.userId}` : "assistant";
      return `[${actor}] ${truncate(normalizeText(message.text), 500)}`;
    })
    .filter((line) => line.length > 0);

  const contextLines = [
    input.sourceChannelId ? `Source channel context: ${input.sourceChannelId}` : "Source channel context: unknown",
    input.teamId ? `Slack team id: ${input.teamId}` : "Slack team id: unknown"
  ];

  if (recent.length === 0) {
    contextLines.push("Recent thread messages: none");
  } else {
    contextLines.push("Recent thread messages:");
    contextLines.push(...recent);
  }

  return contextLines.join("\n");
}

function buildMessages(input: AssistantReplyInput): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content: buildSystemPrompt()
    },
    {
      role: "system",
      content: buildHistoryContext(input)
    },
    {
      role: "user",
      content: truncate(input.text.trim(), 2_000)
    }
  ];
}

export function createOpenAiAssistantReplyGenerator(config: LlmChatConfig): AssistantReplyGenerator {
  return {
    async generateReply(input: AssistantReplyInput): Promise<string> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: config.model,
            temperature: config.temperature,
            messages: buildMessages(input)
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`LLM request failed (${response.status}): ${truncate(normalizeText(errorBody), 300)}`);
        }

        const payload = (await response.json()) as OpenAiChatCompletionResponse;
        const firstChoice = payload.choices?.[0];
        const content = asOpenAiContent(firstChoice?.message?.content);

        if (!content) {
          throw new Error("LLM response did not include message content.");
        }

        return truncate(content, 4_000);
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
