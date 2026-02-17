import { createDb } from "@kwielford/db";
import { handleSlackAssistantEventsInboundRequest, SlackWebApiAdapter } from "@kwielford/slack";

import { VercelWorkflowThreadSummaryDispatcher } from "../adapters/vercel-workflow-thread-summary-dispatcher.js";
import { getApiConfig } from "../env.js";

export async function handleSlackAssistantEventsRequest(request: Request): Promise<Response> {
  const config = getApiConfig();

  return handleSlackAssistantEventsInboundRequest(
    {
      db: createDb(),
      workflow: new VercelWorkflowThreadSummaryDispatcher(),
      slackApi: new SlackWebApiAdapter({
        botToken: config.slackBotToken
      }),
      signingSecret: config.slackSigningSecret,
      defaultWorkspaceId: config.defaultWorkspaceId
    },
    request
  );
}
