import type { ThreadSummaryOutput } from "@kweilford/core";
import { createDb } from "@kweilford/db";
import {
  runThreadSummaryJob,
  SlackWebApiAdapter,
  type ThreadSummaryJobPayload
} from "@kweilford/slack";

import { getApiConfig } from "../env.js";

async function executeThreadSummaryJob(payload: ThreadSummaryJobPayload): Promise<ThreadSummaryOutput> {
  "use step";

  const config = getApiConfig();
  const db = createDb();
  const slackApi = new SlackWebApiAdapter({
    botToken: config.slackBotToken
  });

  return runThreadSummaryJob(
    {
      db,
      fetcher: slackApi,
      responder: slackApi
    },
    payload
  );
}

export async function threadSummaryWorkflow(payload: ThreadSummaryJobPayload): Promise<ThreadSummaryOutput> {
  "use workflow";

  return executeThreadSummaryJob(payload);
}
