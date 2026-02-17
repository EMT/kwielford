import { start } from "workflow/api";

import type { ThreadSummaryJobPayload, ThreadSummaryWorkflowDispatcher } from "@kwielford/app";

import { threadSummaryWorkflow } from "../workflows/thread-summary-workflow.js";

export class VercelWorkflowThreadSummaryDispatcher implements ThreadSummaryWorkflowDispatcher {
  public async enqueueThreadSummaryJob(job: ThreadSummaryJobPayload): Promise<void> {
    await start(threadSummaryWorkflow, [job]);
  }
}
