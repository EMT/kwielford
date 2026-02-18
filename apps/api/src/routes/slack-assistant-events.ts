import { handleSlackAssistantEventsInboundRequest, SlackWebApiAdapter } from "@kwielford/slack";

import { getApiConfig } from "../env.js";

export async function handleSlackAssistantEventsRequest(request: Request): Promise<Response> {
  const config = getApiConfig();

  return handleSlackAssistantEventsInboundRequest(
    {
      slackApi: new SlackWebApiAdapter({
        botToken: config.slackBotToken
      }),
      signingSecret: config.slackSigningSecret
    },
    request
  );
}
