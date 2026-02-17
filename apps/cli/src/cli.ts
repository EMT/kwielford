#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { formatThreadSummaryForSlack, summarizeThread, type ThreadMessage } from "@kwielford/core";
import { createAgentRun, createAuditEvent, createDb, createMessage, updateAgentRunState } from "@kwielford/db";

interface ParsedArgs {
  command?: string;
  channelId?: string;
  threadTs?: string;
  messagesFile?: string;
  workspaceId?: string;
  userId?: string;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { help: false };

  if (argv.length > 0) {
    args.command = argv[0];
  }

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    if (token === "--channel") {
      args.channelId = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--thread") {
      args.threadTs = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--messages-file") {
      args.messagesFile = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--workspace-id") {
      args.workspaceId = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--user-id") {
      args.userId = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

function getUsage(): string {
  return [
    "Usage:",
    "  kwielford thread-summary --channel <channel_id> --thread <thread_ts> --messages-file <path>",
    "",
    "Optional persistence:",
    "  --workspace-id <uuid>  Persist run/message/audit records to Postgres via DATABASE_URL",
    "  --user-id <uuid>       Associate the run with a user id",
    "",
    "Notes:",
    "  The messages file must be JSON with shape:",
    '  [{ "ts": "1700000000.123", "userId": "U123", "text": "Message text" }]'
  ].join("\n");
}

function assertRequired(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing required argument: ${flag}`);
  }

  return value;
}

function asThreadMessages(value: unknown): ThreadMessage[] {
  if (!Array.isArray(value)) {
    throw new Error("Messages file must contain a JSON array.");
  }

  return value.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Message at index ${index} is not an object.`);
    }

    const ts = (item as { ts?: unknown }).ts;
    const text = (item as { text?: unknown }).text;
    const userId = (item as { userId?: unknown }).userId;

    if (typeof ts !== "string" || typeof text !== "string") {
      throw new Error(`Message at index ${index} must include string ts and text fields.`);
    }

    return {
      ts,
      text,
      userId: typeof userId === "string" ? userId : undefined
    };
  });
}

async function maybePersistRun(input: {
  workspaceId?: string;
  userId?: string;
  channelId: string;
  threadTs: string;
  messages: ThreadMessage[];
  summaryText: string;
  summaryPayload: Record<string, unknown>;
}): Promise<string | undefined> {
  if (!input.workspaceId) {
    return undefined;
  }

  const db = createDb();
  const run = await createAgentRun(db, {
    workspaceId: input.workspaceId,
    initiatedByUserId: input.userId,
    triggerSource: "cli",
    taskKind: "thread_summary",
    input: {
      channelId: input.channelId,
      threadTs: input.threadTs,
      messageCount: input.messages.length
    }
  });

  await updateAgentRunState(db, run.id, {
    status: "running",
    startedAt: new Date()
  });

  await createMessage(db, {
    workspaceId: input.workspaceId,
    runId: run.id,
    userId: input.userId,
    source: "cli",
    role: "assistant",
    channelId: input.channelId,
    threadTs: input.threadTs,
    content: input.summaryText,
    payload: input.summaryPayload
  });

  await updateAgentRunState(db, run.id, {
    status: "succeeded",
    output: input.summaryPayload,
    completedAt: new Date(),
    errorText: null
  });

  await createAuditEvent(db, {
    workspaceId: input.workspaceId,
    runId: run.id,
    userId: input.userId,
    actorType: "cli",
    actorId: input.userId,
    eventName: "thread_summary.completed",
    eventData: {
      messageCount: input.messages.length
    }
  });

  return run.id;
}

export async function runCli(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.help || !parsed.command) {
    console.log(getUsage());
    return 0;
  }

  if (parsed.command !== "thread-summary") {
    console.error(`Unknown command: ${parsed.command}`);
    console.log(getUsage());
    return 1;
  }

  try {
    const channelId = assertRequired(parsed.channelId, "--channel");
    const threadTs = assertRequired(parsed.threadTs, "--thread");
    const messagesFile = assertRequired(parsed.messagesFile, "--messages-file");

    const raw = await readFile(messagesFile, "utf8");
    const json = JSON.parse(raw) as unknown;
    const messages = asThreadMessages(json);

    const summary = summarizeThread({
      channelId,
      threadTs,
      messages
    });

    const summaryPayload: Record<string, unknown> = {
      summary: summary.summary,
      decisions: summary.decisions,
      blockers: summary.blockers,
      nextActions: summary.nextActions
    };
    const summaryText = formatThreadSummaryForSlack(summary);
    const runId = await maybePersistRun({
      workspaceId: parsed.workspaceId,
      userId: parsed.userId,
      channelId,
      threadTs,
      messages,
      summaryText,
      summaryPayload
    });

    if (runId) {
      console.log(`Persisted run: ${runId}`);
      console.log("");
    }

    console.log(summaryText);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CLI error";
    console.error(message);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown CLI error";
      console.error(message);
      process.exitCode = 1;
    });
}
