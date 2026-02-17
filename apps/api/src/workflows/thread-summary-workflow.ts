import type { ThreadSummaryOutput } from "@kwielford/core";
import { createDb } from "@kwielford/db";
import {
  runThreadSummaryJob,
  SlackWebApiAdapter,
  type ThreadSummaryJobPayload
} from "@kwielford/slack";

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
