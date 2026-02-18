import { start } from "workflow/api";

import type { SlackAssistantEventJobPayload } from "@kwielford/slack";

import { slackAssistantEventWorkflow } from "../workflows/slack-assistant-event-workflow.js";

export interface AssistantEventJobDispatcher {
  enqueue(job: SlackAssistantEventJobPayload): Promise<void>;
}

export class VercelWorkflowAssistantEventDispatcher implements AssistantEventJobDispatcher {
  public async enqueue(job: SlackAssistantEventJobPayload): Promise<void> {
    await start(slackAssistantEventWorkflow, [job]);
  }
}
