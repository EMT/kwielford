import {
  handleSlackAssistantEventsInboundRequest,
  SlackWebApiAdapter,
  type SlackAssistantEventJobPayload
} from "@kwielford/slack";

import {
  type AssistantEventJobDispatcher,
  VercelWorkflowAssistantEventDispatcher
} from "../adapters/vercel-workflow-assistant-event-dispatcher.js";
import { createOpenAiAssistantReplyGenerator } from "../adapters/llm-chat.js";
import { getApiConfig } from "../env.js";

export interface SlackAssistantEventsRequestOptions {
  eventDispatcher?: AssistantEventJobDispatcher;
}

export async function handleSlackAssistantEventsRequest(
  request: Request,
  options: SlackAssistantEventsRequestOptions = {}
): Promise<Response> {
  const config = getApiConfig();
  const dispatcher = options.eventDispatcher ?? new VercelWorkflowAssistantEventDispatcher();
  const replyGenerator = config.llmApiKey
    ? createOpenAiAssistantReplyGenerator({
        apiKey: config.llmApiKey,
        model: config.llmModel,
        baseUrl: config.llmBaseUrl,
        timeoutMs: config.llmTimeoutMs,
        temperature: config.llmTemperature
      })
    : undefined;

  return handleSlackAssistantEventsInboundRequest(
    {
      slackApi: new SlackWebApiAdapter({
        botToken: config.slackBotToken
      }),
      signingSecret: config.slackSigningSecret,
      replyGenerator,
      enqueueAssistantEventJob: async (job: SlackAssistantEventJobPayload): Promise<void> => {
        await dispatcher.enqueue(job);
      }
    },
    request
  );
}
