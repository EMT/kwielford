import { createHash } from "node:crypto";

import { createDb, getUserBySlackUserId, getWorkspaceBySlackTeamId } from "@kwielford/db";
import {
  extractThreadReference,
  handleThreadSummaryCommand,
  SlackWebApiAdapter,
  verifySlackSignature
} from "@kwielford/slack";

import { VercelWorkflowThreadSummaryDispatcher } from "../adapters/vercel-workflow-thread-summary-dispatcher.js";
import { getApiConfig } from "../env.js";

interface AssistantThreadRef {
  channelId: string;
  threadTs: string;
}

interface AssistantThreadContext {
  sourceChannelId?: string;
  teamId?: string;
}

interface SlackAssistantPrompt {
  title: string;
  message: string;
}

type JsonObject = Record<string, unknown>;

const assistantContextByThread = new Map<string, AssistantThreadContext>();
const MAX_ASSISTANT_CONTEXT_ENTRIES = 500;

const DEFAULT_PROMPTS: SlackAssistantPrompt[] = [
  {
    title: "Summarize a thread",
    message:
      "Summarize this thread: https://fieldwork.slack.com/archives/C123456/p1739999999000100?thread_ts=1739999999.000100&cid=C123456"
  },
  {
    title: "How to use this",
    message: "How do I use this assistant?"
  },
  {
    title: "Scope and output",
    message: "What output format do you post?"
  }
];

function readObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonObject;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function threadKey(ref: AssistantThreadRef): string {
  return `${ref.channelId}:${ref.threadTs}`;
}

function rememberAssistantContext(ref: AssistantThreadRef, context: AssistantThreadContext): void {
  const key = threadKey(ref);

  assistantContextByThread.delete(key);
  assistantContextByThread.set(key, context);

  if (assistantContextByThread.size > MAX_ASSISTANT_CONTEXT_ENTRIES) {
    const oldestKey = assistantContextByThread.keys().next().value;
    if (oldestKey) {
      assistantContextByThread.delete(oldestKey);
    }
  }
}

function getAssistantThreadRef(event: JsonObject): AssistantThreadRef | undefined {
  const assistantThread = readObject(event.assistant_thread);

  const channelId = readString(assistantThread?.channel_id) ?? readString(event.channel);
  const threadTs =
    readString(assistantThread?.thread_ts) ?? readString(event.thread_ts) ?? readString(event.ts);

  if (!channelId || !threadTs) {
    return undefined;
  }

  return {
    channelId,
    threadTs
  };
}

function getAssistantContext(event: JsonObject): AssistantThreadContext {
  const assistantThread = readObject(event.assistant_thread);
  const context = readObject(assistantThread?.context);

  return {
    sourceChannelId: readString(context?.channel_id),
    teamId: readString(context?.team_id)
  };
}

function isAssistantMessageEvent(event: JsonObject): boolean {
  return readString(event.type) === "message" && readString(event.channel_type) === "im";
}

function isBotMessage(event: JsonObject): boolean {
  return Boolean(event.bot_id) || readString(event.subtype) === "bot_message";
}

async function resolveWorkspaceId(input: {
  teamId?: string;
  defaultWorkspaceId?: string;
}): Promise<string | undefined> {
  const db = createDb();

  if (input.teamId) {
    const workspace = await getWorkspaceBySlackTeamId(db, input.teamId);
    if (workspace) {
      return workspace.id;
    }
  }

  return input.defaultWorkspaceId;
}

async function resolveInitiatedByUserId(input: {
  workspaceId: string;
  slackUserId?: string;
}): Promise<string | undefined> {
  if (!input.slackUserId) {
    return undefined;
  }

  const db = createDb();
  const user = await getUserBySlackUserId(db, input.workspaceId, input.slackUserId);
  return user?.id;
}

function toCommandId(input: { eventId?: string; eventTs?: string; text?: string }): string {
  if (input.eventId) {
    return `assistant-event:${input.eventId}`;
  }

  const hashInput = `${input.eventTs ?? ""}:${input.text ?? ""}`;
  return `assistant-hash:${createHash("sha256").update(hashInput).digest("hex")}`;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function parseJsonObject(rawBody: string): JsonObject | undefined {
  try {
    return readObject(JSON.parse(rawBody));
  } catch {
    return undefined;
  }
}

function okResponse(): Response {
  return new Response("OK", { status: 200 });
}

function asTeamId(envelope: JsonObject, event: JsonObject, context?: AssistantThreadContext): string | undefined {
  return readString(envelope.team_id) ?? readString(event.team) ?? context?.teamId;
}

function asHelpText(): string {
  return [
    "I can queue a thread summary and post results in that thread.",
    "Send a thread permalink, for example:",
    "https://fieldwork.slack.com/archives/C123456/p1739999999000100?thread_ts=1739999999.000100&cid=C123456"
  ].join("\n");
}

async function safeSetAssistantUX(
  slackApi: SlackWebApiAdapter,
  ref: AssistantThreadRef,
  options: {
    setTitle?: string;
    setStatus?: string;
    prompts?: SlackAssistantPrompt[];
  }
): Promise<void> {
  if (options.setTitle) {
    try {
      await slackApi.setAssistantThreadTitle({
        channelId: ref.channelId,
        threadTs: ref.threadTs,
        title: options.setTitle
      });
    } catch {
      // non-critical UX update
    }
  }

  if (options.setStatus) {
    try {
      await slackApi.setAssistantThreadStatus({
        channelId: ref.channelId,
        threadTs: ref.threadTs,
        status: options.setStatus
      });
    } catch {
      // non-critical UX update
    }
  }

  if (options.prompts && options.prompts.length > 0) {
    try {
      await slackApi.setAssistantThreadSuggestedPrompts({
        channelId: ref.channelId,
        threadTs: ref.threadTs,
        prompts: options.prompts
      });
    } catch {
      // non-critical UX update
    }
  }
}

async function handleAssistantThreadStartedEvent(input: {
  event: JsonObject;
  slackApi: SlackWebApiAdapter;
}): Promise<void> {
  const ref = getAssistantThreadRef(input.event);
  if (!ref) {
    return;
  }

  const context = getAssistantContext(input.event);
  rememberAssistantContext(ref, context);

  await safeSetAssistantUX(input.slackApi, ref, {
    setTitle: "Kwielford assistant",
    prompts: DEFAULT_PROMPTS
  });
}

async function handleAssistantMessageEvent(input: {
  envelope: JsonObject;
  event: JsonObject;
  slackApi: SlackWebApiAdapter;
}): Promise<void> {
  if (!isAssistantMessageEvent(input.event) || isBotMessage(input.event)) {
    return;
  }

  const assistantRef = getAssistantThreadRef(input.event);
  if (!assistantRef) {
    return;
  }

  const context = assistantContextByThread.get(threadKey(assistantRef));
  const text = readString(input.event.text)?.trim() ?? "";

  if (!text) {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: asHelpText()
    });
    return;
  }

  const lowerText = text.toLowerCase();
  if (lowerText === "help" || lowerText === "how do i use this assistant?") {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: asHelpText()
    });
    return;
  }

  const extracted = extractThreadReference(text);
  const targetChannelId = extracted.channelId ?? context?.sourceChannelId;
  const targetThreadTs = extracted.threadTs;

  if (!targetThreadTs || !targetChannelId) {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text:
        "Please include a Slack thread permalink so I can summarize the exact thread. Send `help` for an example."
    });
    return;
  }

  const config = getApiConfig();
  const workspaceId = await resolveWorkspaceId({
    teamId: asTeamId(input.envelope, input.event, context),
    defaultWorkspaceId: config.defaultWorkspaceId
  });

  if (!workspaceId) {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: "Workspace mapping is missing. Set DEFAULT_WORKSPACE_ID or map the Slack team in the database."
    });
    return;
  }

  await safeSetAssistantUX(input.slackApi, assistantRef, {
    setStatus: "Queuing thread summary..."
  });

  const workflow = new VercelWorkflowThreadSummaryDispatcher();
  const db = createDb();
  const commandId = toCommandId({
    eventId: readString(input.envelope.event_id),
    eventTs: readString(input.event.event_ts) ?? readString(input.event.ts),
    text
  });
  const initiatedByUserId = await resolveInitiatedByUserId({
    workspaceId,
    slackUserId: readString(input.event.user)
  });

  const ack = await handleThreadSummaryCommand(
    {
      db,
      workflow
    },
    {
      workspaceId,
      channelId: targetChannelId,
      threadTs: targetThreadTs,
      commandId,
      initiatedByUserId,
      actorId: readString(input.event.user)
    }
  );

  await input.slackApi.postThreadReply({
    channelId: assistantRef.channelId,
    threadTs: assistantRef.threadTs,
    text: `${ack.responseText}\nRun id: ${ack.runId}`
  });
}

export async function handleSlackAssistantEventsRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST"
      }
    });
  }

  const rawBody = await request.text();
  const config = getApiConfig();
  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");

  const verified = verifySlackSignature({
    signingSecret: config.slackSigningSecret,
    rawBody,
    signature,
    timestamp
  });

  if (!verified) {
    return new Response("Invalid Slack signature", { status: 401 });
  }

  const envelope = parseJsonObject(rawBody);
  if (!envelope) {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  if (readString(envelope.type) === "url_verification") {
    const challenge = readString(envelope.challenge);
    if (!challenge) {
      return new Response("Missing challenge", { status: 400 });
    }
    return jsonResponse({ challenge });
  }

  if (readString(envelope.type) !== "event_callback") {
    return okResponse();
  }

  const event = readObject(envelope.event);
  if (!event) {
    return okResponse();
  }

  const slackApi = new SlackWebApiAdapter({
    botToken: config.slackBotToken
  });
  const eventType = readString(event.type);

  if (eventType === "assistant_thread_started" || eventType === "assistant_thread_context_changed") {
    await handleAssistantThreadStartedEvent({
      event,
      slackApi
    });
    return okResponse();
  }

  if (isAssistantMessageEvent(event)) {
    await handleAssistantMessageEvent({
      envelope,
      event,
      slackApi
    });
  }

  return okResponse();
}
