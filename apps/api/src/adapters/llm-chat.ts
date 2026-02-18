import { createGateway, generateText } from "ai";

import type { AssistantReplyGenerator, AssistantReplyInput } from "@kwielford/slack";

export interface LlmChatConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  temperature: number;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
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

export function createAiGatewayAssistantReplyGenerator(config: LlmChatConfig): AssistantReplyGenerator {
  const gateway = createGateway({
    apiKey: config.apiKey,
    baseURL: config.baseUrl
  });

  return {
    async generateReply(input: AssistantReplyInput): Promise<string> {
      const { text } = await generateText({
        model: gateway(config.model),
        system: buildSystemPrompt(),
        prompt: [buildHistoryContext(input), "", truncate(input.text.trim(), 2_000)].join("\n"),
        temperature: config.temperature,
        timeout: config.timeoutMs,
        providerOptions: {
          gateway: {
            tags: ["kwielford", "slack-assistant"],
            ...(input.teamId ? { user: input.teamId } : {})
          }
        }
      });

      const content = normalizeText(text);
      if (!content) {
        throw new Error("LLM response did not include message content.");
      }

      return truncate(content, 4_000);
    }
  };
}
