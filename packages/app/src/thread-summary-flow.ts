import {
  formatThreadSummaryText,
  summarizeThread,
  type ThreadMessage,
  type ThreadSummaryInput,
  type ThreadSummaryOutput
} from "@kwielford/core";
import {
  createAgentRun,
  createAuditEvent,
  createMessage,
  updateAgentRunState,
  type AuditActorType,
  type DbClient,
  type MessageSource
} from "@kwielford/db";

export interface ThreadSummaryCommandPayload {
  workspaceId: string;
  channelId: string;
  threadTs: string;
  commandId: string;
  triggerSource: MessageSource;
  actorType: AuditActorType;
  initiatedByUserId?: string;
  actorId?: string;
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
  outputSource: MessageSource;
  initiatedByUserId?: string;
  actorId?: string;
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

export interface ThreadSummaryResponder {
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
  responder: ThreadSummaryResponder;
  formatter?: ThreadSummaryResultFormatter;
  summarizer?: ThreadSummaryJobSummarizer;
}

export type ThreadSummaryJobSummarizer = (
  input: ThreadSummaryInput
) => Promise<ThreadSummaryOutput>;

export type ThreadSummaryResultFormatter = (
  output: ThreadSummaryOutput
) => string;

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
    initiatedByUserId: payload.initiatedByUserId,
    triggerSource: payload.triggerSource,
    taskKind: "thread_summary",
    idempotencyKey: `${payload.triggerSource}:${payload.commandId}`,
    input: {
      channelId: payload.channelId,
      threadTs: payload.threadTs,
      commandId: payload.commandId
    }
  });

  await createAuditEvent(deps.db, {
    workspaceId: payload.workspaceId,
    runId: run.id,
    userId: payload.initiatedByUserId,
    actorType: payload.actorType,
    actorId: payload.actorId,
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
    outputSource: payload.triggerSource,
    initiatedByUserId: payload.initiatedByUserId,
    actorId: payload.actorId
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

    const summaryInput: ThreadSummaryInput = {
      channelId: payload.channelId,
      threadTs: payload.threadTs,
      messages
    };
    const summary =
      deps.summarizer
        ? await deps.summarizer(summaryInput).catch(async (error) => {
            const message = toErrorMessage(error);
            await createAuditEvent(deps.db, {
              workspaceId: payload.workspaceId,
              runId: payload.runId,
              userId: payload.initiatedByUserId,
              actorType: "system",
              eventName: "thread_summary.llm_fallback",
              eventData: {
                error: message
              }
            });

            return summarizeThread(summaryInput);
          })
        : summarizeThread(summaryInput);
    const summaryPayload: Record<string, unknown> = {
      summary: summary.summary,
      decisions: summary.decisions,
      blockers: summary.blockers,
      nextActions: summary.nextActions
    };

    const summaryText = deps.formatter ? deps.formatter(summary) : formatThreadSummaryText(summary);

    await createMessage(deps.db, {
      workspaceId: payload.workspaceId,
      runId: payload.runId,
      userId: payload.initiatedByUserId,
      source: payload.outputSource,
      role: "assistant",
      channelId: payload.channelId,
      threadTs: payload.threadTs,
      content: summaryText,
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
      userId: payload.initiatedByUserId,
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
      text: summaryText
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
      userId: payload.initiatedByUserId,
      actorType: "system",
      eventName: "thread_summary.failed",
      eventData: {
        error: message
      }
    });

    throw error;
  }
}
