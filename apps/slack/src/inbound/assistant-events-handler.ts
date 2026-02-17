import { createHash } from "node:crypto";

import { handleThreadSummaryCommand, type ThreadSummaryWorkflowDispatcher } from "@kwielford/app";
import { getUserBySlackUserId, getWorkspaceBySlackTeamId, type DbClient } from "@kwielford/db";

import { SlackWebApiAdapter } from "../adapters/slack-web-api.js";
import { extractThreadReference } from "../parsers/slash-command.js";
import { verifySlackSignature } from "../security/verify-slack-signature.js";

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

export interface SlackAssistantEventsInboundDeps {
  db: DbClient;
  workflow: ThreadSummaryWorkflowDispatcher;
  slackApi: SlackWebApiAdapter;
  signingSecret: string;
  defaultWorkspaceId?: string;
}

const assistantContextByThread = new Map<string, AssistantThreadContext>();
const MAX_ASSISTANT_CONTEXT_ENTRIES = 500;

const DEFAULT_PROMPTS: SlackAssistantPrompt[] = [
  {
    title: "Improve Kwielford",
    message: "Help us make you a better assistant. What should we build first?"
  },
  {
    title: "Assistant roadmap",
    message: "Suggest a 2-week roadmap to make you more useful for our team."
  },
  {
    title: "Summarize a thread",
    message:
      "Summarize this thread: https://fieldwork.slack.com/archives/C123456/p1739999999000100?thread_ts=1739999999.000100&cid=C123456"
  },
  {
    title: "How to use this",
    message: "How do I use this assistant?"
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
  db: DbClient;
  teamId?: string;
  defaultWorkspaceId?: string;
}): Promise<string | undefined> {
  if (input.teamId) {
    const workspace = await getWorkspaceBySlackTeamId(input.db, input.teamId);
    if (workspace) {
      return workspace.id;
    }
  }

  return input.defaultWorkspaceId;
}

async function resolveInitiatedByUserId(input: {
  db: DbClient;
  workspaceId: string;
  slackUserId?: string;
}): Promise<string | undefined> {
  if (!input.slackUserId) {
    return undefined;
  }

  const user = await getUserBySlackUserId(input.db, input.workspaceId, input.slackUserId);
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
    "I can help in two modes:",
    "1) Improvement planning: ask how to make me a better assistant and I will suggest concrete builds/setups.",
    "2) Thread summary: send a thread permalink and I will queue a summary workflow.",
    "",
    "Thread permalink example:",
    "https://fieldwork.slack.com/archives/C123456/p1739999999000100?thread_ts=1739999999.000100&cid=C123456",
    "",
    "Try: `Help us make you better. What should we build first?`"
  ].join("\n");
}

function asKickoffText(): string {
  return [
    "Let's make me a better assistant for your team.",
    "I can suggest specific things to build and set up so I can help more effectively.",
    "",
    "High-impact upgrades to start with:",
    "1) Memory and context",
    "   - Team goals, owners, project glossary, definition of done",
    "2) Integrations",
    "   - Linear/Jira, GitHub, docs/wiki, incident tooling",
    "3) Workflows",
    "   - Daily standup digest, blocker tracking, action-item follow-up",
    "4) Quality controls",
    "   - Required output format, confidence labels, human-approval gates",
    "",
    "Reply with `memory`, `integrations`, `workflows`, `quality`, or `roadmap` and I'll draft a concrete plan."
  ].join("\n");
}

function asImprovementRoadmapText(): string {
  return [
    "Suggested first roadmap:",
    "1) Context pack (1 day): team goals, project map, owners, key links.",
    "2) Integration pass (2-3 days): connect ticketing + code + docs sources.",
    "3) Workflow automations (2 days): standup digest, blockers, decision log.",
    "4) Response contracts (1 day): output templates, severity levels, escalation rules.",
    "5) Validation loop (ongoing): weekly feedback review and prompt/tool updates.",
    "",
    "If you want, I can turn this into a scoped backlog with owners and acceptance criteria."
  ].join("\n");
}

function asTopicPlanText(topic: "memory" | "integrations" | "workflows" | "quality"): string {
  if (topic === "memory") {
    return [
      "Memory setup plan:",
      "1) Create a canonical project context doc (mission, owners, glossary, constraints).",
      "2) Add a decision log with date, decision, rationale, and links.",
      "3) Add per-team preferences (tone, format, escalation defaults).",
      "4) Add a weekly refresh checklist so stale context is corrected.",
      "",
      "Build target: a machine-readable context bundle I can load before answering."
    ].join("\n");
  }

  if (topic === "integrations") {
    return [
      "Integration setup plan:",
      "1) Ticket source: sync open work, priorities, and due dates from Linear/Jira.",
      "2) Code source: map PRs/commits to tickets and release notes from GitHub.",
      "3) Knowledge source: index docs/runbooks and expose retrieval endpoints.",
      "4) Incident source: ingest alerts/incidents to connect impact with team actions.",
      "",
      "Build target: one unified context feed that I can cite when suggesting actions."
    ].join("\n");
  }

  if (topic === "workflows") {
    return [
      "Workflow setup plan:",
      "1) Daily digest: blockers, decisions, ownership gaps, upcoming deadlines.",
      "2) Action-item tracker: assign owners and due dates directly from thread summaries.",
      "3) Follow-up reminders: ping unresolved items after agreed SLA.",
      "4) Weekly retro brief: wins, misses, and process improvements.",
      "",
      "Build target: fewer dropped tasks and clearer operational visibility."
    ].join("\n");
  }

  return [
    "Quality-control setup plan:",
    "1) Define required response formats by task type (summary, incident, planning).",
    "2) Add confidence and evidence requirements to every high-impact answer.",
    "3) Add approval gates for sensitive actions (external posts, escalations).",
    "4) Track quality metrics: false positives, missed actions, correction latency.",
    "",
    "Build target: predictable, auditable assistant behavior with fewer regressions."
  ].join("\n");
}

function toImprovementTopic(text: string): "memory" | "integrations" | "workflows" | "quality" | "roadmap" | undefined {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("memory") || lowerText.includes("context")) {
    return "memory";
  }

  if (
    lowerText.includes("integration") ||
    lowerText.includes("jira") ||
    lowerText.includes("linear") ||
    lowerText.includes("github") ||
    lowerText.includes("notion")
  ) {
    return "integrations";
  }

  if (
    lowerText.includes("workflow") ||
    lowerText.includes("automation") ||
    lowerText.includes("digest") ||
    lowerText.includes("standup")
  ) {
    return "workflows";
  }

  if (
    lowerText.includes("quality") ||
    lowerText.includes("guardrail") ||
    lowerText.includes("approval") ||
    lowerText.includes("confidence")
  ) {
    return "quality";
  }

  if (
    lowerText.includes("roadmap") ||
    lowerText.includes("plan") ||
    lowerText.includes("what should we build") ||
    lowerText.includes("make you better")
  ) {
    return "roadmap";
  }

  return undefined;
}

function isLikelySummaryRequest(text: string): boolean {
  const lowerText = text.toLowerCase();
  return lowerText.includes("summarize") || lowerText.includes("summary") || lowerText.includes("thread");
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

  await input.slackApi.postThreadReply({
    channelId: ref.channelId,
    threadTs: ref.threadTs,
    text: asKickoffText()
  });
}

async function handleAssistantThreadContextChangedEvent(input: {
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
  db: DbClient;
  workflow: ThreadSummaryWorkflowDispatcher;
  defaultWorkspaceId?: string;
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
    const topic = toImprovementTopic(text);

    if (topic === "roadmap") {
      await input.slackApi.postThreadReply({
        channelId: assistantRef.channelId,
        threadTs: assistantRef.threadTs,
        text: asImprovementRoadmapText()
      });
      return;
    }

    if (topic) {
      await input.slackApi.postThreadReply({
        channelId: assistantRef.channelId,
        threadTs: assistantRef.threadTs,
        text: asTopicPlanText(topic)
      });
      return;
    }

    if (isLikelySummaryRequest(text)) {
      await input.slackApi.postThreadReply({
        channelId: assistantRef.channelId,
        threadTs: assistantRef.threadTs,
        text:
          "Please include a Slack thread permalink so I can summarize the exact thread. Send `help` for an example."
      });
      return;
    }

    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: [asImprovementRoadmapText(), "", "If you prefer, paste a thread permalink and I can summarize it."].join(
        "\n"
      )
    });
    return;
  }

  const workspaceId = await resolveWorkspaceId({
    db: input.db,
    teamId: asTeamId(input.envelope, input.event, context),
    defaultWorkspaceId: input.defaultWorkspaceId
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

  const commandId = toCommandId({
    eventId: readString(input.envelope.event_id),
    eventTs: readString(input.event.event_ts) ?? readString(input.event.ts),
    text
  });
  const initiatedByUserId = await resolveInitiatedByUserId({
    db: input.db,
    workspaceId,
    slackUserId: readString(input.event.user)
  });

  const ack = await handleThreadSummaryCommand(
    {
      db: input.db,
      workflow: input.workflow
    },
    {
      workspaceId,
      channelId: targetChannelId,
      threadTs: targetThreadTs,
      commandId,
      triggerSource: "slack",
      actorType: "slack",
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

export async function handleSlackAssistantEventsInboundRequest(
  deps: SlackAssistantEventsInboundDeps,
  request: Request
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST"
      }
    });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");

  const verified = verifySlackSignature({
    signingSecret: deps.signingSecret,
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

  const eventType = readString(event.type);

  if (eventType === "assistant_thread_started") {
    await handleAssistantThreadStartedEvent({
      event,
      slackApi: deps.slackApi
    });
    return okResponse();
  }

  if (eventType === "assistant_thread_context_changed") {
    await handleAssistantThreadContextChangedEvent({
      event,
      slackApi: deps.slackApi
    });
    return okResponse();
  }

  if (isAssistantMessageEvent(event)) {
    await handleAssistantMessageEvent({
      db: deps.db,
      workflow: deps.workflow,
      defaultWorkspaceId: deps.defaultWorkspaceId,
      envelope,
      event,
      slackApi: deps.slackApi
    });
  }

  return okResponse();
}
