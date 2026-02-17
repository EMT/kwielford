import {
  runThreadSummaryJob,
  type ThreadSummaryJobPayload
} from "@kwielford/app";
import type { ThreadSummaryOutput } from "@kwielford/core";
import { createDb } from "@kwielford/db";
import { formatThreadSummaryForSlack, SlackWebApiAdapter } from "@kwielford/slack";

import { summarizeThreadWithAiGateway } from "../adapters/ai-gateway-thread-summarizer.js";
import { getApiConfig } from "../env.js";

async function executeThreadSummaryJob(payload: ThreadSummaryJobPayload): Promise<ThreadSummaryOutput> {
  "use step";

  const config = getApiConfig();
  const db = createDb();
  const slackApi = new SlackWebApiAdapter({
    botToken: config.slackBotToken
  });
  const summarizer = config.aiGatewayApiKey
    ? async (input: Parameters<typeof summarizeThreadWithAiGateway>[0]) =>
        summarizeThreadWithAiGateway(input, {
          apiKey: config.aiGatewayApiKey ?? "",
          model: config.aiGatewayModel,
          baseURL: config.aiGatewayBaseUrl,
          timeoutMs: config.aiSummaryTimeoutMs
        })
    : undefined;

  return runThreadSummaryJob(
    {
      db,
      fetcher: slackApi,
      responder: slackApi,
      formatter: formatThreadSummaryForSlack,
      summarizer
    },
    payload
  );
}

export async function threadSummaryWorkflow(payload: ThreadSummaryJobPayload): Promise<ThreadSummaryOutput> {
  "use workflow";

  return executeThreadSummaryJob(payload);
}
