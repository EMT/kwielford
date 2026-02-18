import {
  handleSlackAssistantEventJob,
  SlackWebApiAdapter,
  type SlackAssistantEventJobPayload
} from "@kwielford/slack";

import { createOpenAiAssistantReplyGenerator } from "../adapters/llm-chat.js";
import { getApiConfig } from "../env.js";

async function executeSlackAssistantEventJob(payload: SlackAssistantEventJobPayload): Promise<void> {
  "use step";

  const config = getApiConfig();
  const slackApi = new SlackWebApiAdapter({
    botToken: config.slackBotToken
  });
  const replyGenerator = config.llmApiKey
    ? createOpenAiAssistantReplyGenerator({
        apiKey: config.llmApiKey,
        model: config.llmModel,
        baseUrl: config.llmBaseUrl,
        timeoutMs: config.llmTimeoutMs,
        temperature: config.llmTemperature
      })
    : undefined;

  await handleSlackAssistantEventJob(
    {
      slackApi,
      replyGenerator
    },
    payload
  );
}

export async function slackAssistantEventWorkflow(payload: SlackAssistantEventJobPayload): Promise<void> {
  "use workflow";

  await executeSlackAssistantEventJob(payload);
}
