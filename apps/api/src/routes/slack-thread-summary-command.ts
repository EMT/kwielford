import { createDb } from "@kwielford/db";
import { handleSlackThreadSummaryCommandInboundRequest } from "@kwielford/slack";

import { VercelWorkflowThreadSummaryDispatcher } from "../adapters/vercel-workflow-thread-summary-dispatcher.js";
import { getApiConfig } from "../env.js";

export async function handleSlackThreadSummaryCommandRequest(request: Request): Promise<Response> {
  const config = getApiConfig();

  return handleSlackThreadSummaryCommandInboundRequest(
    {
      db: createDb(),
      workflow: new VercelWorkflowThreadSummaryDispatcher(),
      signingSecret: config.slackSigningSecret,
      allowedSlashCommands: config.allowedSlashCommands,
      defaultWorkspaceId: config.defaultWorkspaceId
    },
    request
  );
}
