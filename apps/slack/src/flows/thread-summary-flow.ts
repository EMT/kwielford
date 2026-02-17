import {
  formatThreadSummaryForSlack,
  summarizeThread,
  type ThreadMessage,
  type ThreadSummaryOutput
} from "@kwielford/core";
import {
  createAgentRun,
  createAuditEvent,
  createMessage,
  updateAgentRunState,
  type DbClient
} from "@kwielford/db";

export interface ThreadSummaryCommandPayload {
  workspaceId: string;
  channelId: string;
  threadTs: string;
  commandId: string;
  userId?: string;
}

export interface ThreadSummaryCommandAck {
  runId: string;
  responseText: string;
}

export interface ThreadSummaryJobPayload {
  runId: string;
  workspaceId: string;
  channelId: string;
  threadTs: string;
  userId?: string;
}

export interface ThreadSummaryMessageFetcher {
  fetchThreadMessages(input: {
    workspaceId: string;
    channelId: string;
    threadTs: string;
  }): Promise<ThreadMessage[]>;
}

export interface ThreadSummaryWorkflowDispatcher {
  enqueueThreadSummaryJob(job: ThreadSummaryJobPayload): Promise<void>;
}

export interface ThreadSummarySlackResponder {
  postThreadReply(input: {
    channelId: string;
    threadTs: string;
    text: string;
  }): Promise<void>;
}

export interface ThreadSummaryFlowDeps {
  db: DbClient;
  workflow: ThreadSummaryWorkflowDispatcher;
}

export interface ThreadSummaryJobDeps {
  db: DbClient;
  fetcher: ThreadSummaryMessageFetcher;
  responder: ThreadSummarySlackResponder;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown thread summary error";
}

export async function handleThreadSummaryCommand(
  deps: ThreadSummaryFlowDeps,
  payload: ThreadSummaryCommandPayload
): Promise<ThreadSummaryCommandAck> {
  const run = await createAgentRun(deps.db, {
    workspaceId: payload.workspaceId,
    initiatedByUserId: payload.userId,
    triggerSource: "slack",
    taskKind: "thread_summary",
    idempotencyKey: `slack:${payload.commandId}`,
    input: {
      channelId: payload.channelId,
      threadTs: payload.threadTs,
      commandId: payload.commandId
    }
  });

  await createAuditEvent(deps.db, {
    workspaceId: payload.workspaceId,
    runId: run.id,
    userId: payload.userId,
    actorType: "slack",
    actorId: payload.userId,
    eventName: "thread_summary.command_received",
    eventData: {
      channelId: payload.channelId,
      threadTs: payload.threadTs,
      commandId: payload.commandId
    }
  });

  await deps.workflow.enqueueThreadSummaryJob({
    runId: run.id,
    workspaceId: payload.workspaceId,
    channelId: payload.channelId,
    threadTs: payload.threadTs,
    userId: payload.userId
  });

  return {
    runId: run.id,
    responseText: "Queued. I will post a summary in this thread shortly."
  };
}

export async function runThreadSummaryJob(
  deps: ThreadSummaryJobDeps,
  payload: ThreadSummaryJobPayload
): Promise<ThreadSummaryOutput> {
  try {
    await updateAgentRunState(deps.db, payload.runId, {
      status: "running",
      startedAt: new Date()
    });

    const messages = await deps.fetcher.fetchThreadMessages({
      workspaceId: payload.workspaceId,
      channelId: payload.channelId,
      threadTs: payload.threadTs
    });

    const summary = summarizeThread({
      channelId: payload.channelId,
      threadTs: payload.threadTs,
      messages
    });
    const summaryPayload: Record<string, unknown> = {
      summary: summary.summary,
      decisions: summary.decisions,
      blockers: summary.blockers,
      nextActions: summary.nextActions
    };

    const slackText = formatThreadSummaryForSlack(summary);

    await createMessage(deps.db, {
      workspaceId: payload.workspaceId,
      runId: payload.runId,
      userId: payload.userId,
      source: "slack",
      role: "assistant",
      channelId: payload.channelId,
      threadTs: payload.threadTs,
      content: slackText,
      payload: summaryPayload
    });

    await updateAgentRunState(deps.db, payload.runId, {
      status: "succeeded",
      output: summaryPayload,
      completedAt: new Date(),
      errorText: null
    });

    await createAuditEvent(deps.db, {
      workspaceId: payload.workspaceId,
      runId: payload.runId,
      userId: payload.userId,
      actorType: "system",
      eventName: "thread_summary.completed",
      eventData: {
        messageCount: messages.length,
        decisions: summary.decisions.length,
        blockers: summary.blockers.length,
        nextActions: summary.nextActions.length
      }
    });

    await deps.responder.postThreadReply({
      channelId: payload.channelId,
      threadTs: payload.threadTs,
      text: slackText
    });

    return summary;
  } catch (error) {
    const message = toErrorMessage(error);

    await updateAgentRunState(deps.db, payload.runId, {
      status: "failed",
      completedAt: new Date(),
      errorText: message
    });

    await createAuditEvent(deps.db, {
      workspaceId: payload.workspaceId,
      runId: payload.runId,
      userId: payload.userId,
      actorType: "system",
      eventName: "thread_summary.failed",
      eventData: {
        error: message
      }
    });

    throw error;
  }
}
