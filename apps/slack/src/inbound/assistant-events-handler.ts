import { SlackWebApiAdapter } from "../adapters/slack-web-api.js";
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
  slackApi: SlackWebApiAdapter;
  signingSecret: string;
  replyGenerator?: AssistantReplyGenerator;
  enqueueAssistantEventJob?: (job: SlackAssistantEventJobPayload) => Promise<void>;
}

export interface AssistantReplyInput {
  text: string;
  sourceChannelId?: string;
  teamId?: string;
  threadMessages: Array<{
    ts: string;
    userId?: string;
    text: string;
  }>;
}

export interface AssistantReplyGenerator {
  generateReply(input: AssistantReplyInput): Promise<string>;
}

export interface SlackAssistantEventJobPayload {
  event: Record<string, unknown>;
  eventId?: string;
}

export interface SlackAssistantEventJobDeps {
  slackApi: SlackWebApiAdapter;
  replyGenerator?: AssistantReplyGenerator;
}

const assistantContextByThread = new Map<string, AssistantThreadContext>();
const MAX_ASSISTANT_CONTEXT_ENTRIES = 500;
const seenEventIds = new Map<string, { expiresAt: number; status: "processing" | "done" }>();
const EVENT_ID_TTL_MS = 10 * 60 * 1000;

const DEFAULT_PROMPTS: SlackAssistantPrompt[] = [
  {
    title: "Improve Kwielford",
    message: "Help us make you a better assistant. What should we build first?"
  },
  {
    title: "Access rollout",
    message: "How should we incrementally give you more channel and tool access?"
  },
  {
    title: "Cross-channel plan",
    message: "Propose a phased plan for expanding your access across Slack channels and systems."
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

function describeError(error: unknown): { name?: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error)
  };
}

function cleanupSeenEventIds(now: number): void {
  for (const [eventId, state] of seenEventIds.entries()) {
    if (state.expiresAt <= now) {
      seenEventIds.delete(eventId);
    }
  }
}

function tryStartEvent(eventId: string): boolean {
  const now = Date.now();
  cleanupSeenEventIds(now);

  if (seenEventIds.has(eventId)) {
    return false;
  }

  seenEventIds.set(eventId, {
    expiresAt: now + EVENT_ID_TTL_MS,
    status: "processing"
  });
  return true;
}

function markEventDone(eventId: string): void {
  seenEventIds.set(eventId, {
    expiresAt: Date.now() + EVENT_ID_TTL_MS,
    status: "done"
  });
}

function markEventFailed(eventId: string): void {
  seenEventIds.delete(eventId);
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
  if (readString(event.type) !== "message") {
    return false;
  }

  const channelType = readString(event.channel_type);
  return channelType === "im" || channelType === "mpim";
}

function isBotMessage(event: JsonObject): boolean {
  return Boolean(event.bot_id) || readString(event.subtype) === "bot_message";
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

function asHelpText(): string {
  return [
    "I can help in two modes:",
    "1) Improve Kwielford: I suggest what to build next so I can help more effectively.",
    "2) Access rollout: I help you phase access across channels and tools safely.",
    "",
    "Try:",
    "- `Help us make you better. What should we build first?`",
    "- `How should we roll out your access across channels?`",
    "- `Give me an access plan for Slack + GitHub + docs.`"
  ].join("\n");
}

function asKickoffText(): string {
  return [
    "Current focus:",
    "1) We can chat about how to improve Kwielford.",
    "2) We can incrementally expand Kwielford access across channels so I can help better.",
    "",
    "Reply with `roadmap`, `memory`, `integrations`, `workflows`, `quality`, or `access` and I will draft a concrete plan."
  ].join("\n");
}

function asImprovementRoadmapText(): string {
  return [
    "Suggested near-term roadmap:",
    "1) Context pack (1 day): goals, owners, glossary, constraints.",
    "2) Integration pass (2-3 days): connect ticketing, code, and docs sources.",
    "3) Workflow automations (2 days): digests, blockers, and decision tracking.",
    "4) Response contracts (1 day): output templates, confidence labels, escalation rules.",
    "5) Validation loop (ongoing): weekly feedback and prompt/tool updates.",
    "",
    "If useful, I can turn this into a backlog with owners and acceptance criteria."
  ].join("\n");
}

function asAccessPlanText(context?: AssistantThreadContext): string {
  const contextLine = context?.sourceChannelId
    ? `Current source channel context: ${context.sourceChannelId}`
    : "No source channel context is currently attached to this assistant thread.";

  return [
    "Access rollout plan:",
    "1) Define value targets: what decisions/actions should improve first.",
    "2) Pilot channels: grant 1-2 high-signal channels with clear owners.",
    "3) Add systems in order: ticketing, code, docs, then incidents.",
    "4) Add controls: response contracts, confidence labels, approval gates.",
    "5) Expand scope weekly based on observed quality and missed-action rate.",
    "",
    contextLine,
    "",
    "If you share your current tools and constraints, I can produce a phased access matrix."
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
      "2) Code source: map PRs/commits to tickets and releases from GitHub.",
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
      "2) Action-item tracker: assign owners and due dates from operational conversations.",
      "3) Follow-up reminders: ping unresolved items after agreed SLA.",
      "4) Weekly retro brief: wins, misses, and process improvements.",
      "",
      "Build target: fewer dropped tasks and clearer operational visibility."
    ].join("\n");
  }

  return [
    "Quality-control setup plan:",
    "1) Define required response formats by task type (planning, incident, execution).",
    "2) Add confidence and evidence requirements to high-impact answers.",
    "3) Add approval gates for sensitive actions (external posts, escalations).",
    "4) Track quality metrics: false positives, missed actions, correction latency.",
    "",
    "Build target: predictable, auditable assistant behavior with fewer regressions."
  ].join("\n");
}

function toImprovementTopic(
  text: string
): "memory" | "integrations" | "workflows" | "quality" | "roadmap" | "access" | undefined {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("access") || lowerText.includes("permission") || lowerText.includes("channel")) {
    return "access";
  }

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

function toExplicitTopicCommand(
  text: string
): "memory" | "integrations" | "workflows" | "quality" | "roadmap" | "access" | undefined {
  const normalized = text.trim().toLowerCase();
  const command = normalized.startsWith("/") ? normalized.slice(1) : normalized;

  if (command === "roadmap" || command === "access") {
    return command;
  }

  if (command === "memory" || command === "integrations" || command === "workflows" || command === "quality") {
    return command;
  }

  return undefined;
}

async function safeSetAssistantUX(
  slackApi: SlackWebApiAdapter,
  ref: AssistantThreadRef,
  options: {
    setTitle?: string;
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
  event: JsonObject;
  slackApi: SlackWebApiAdapter;
  replyGenerator?: AssistantReplyGenerator;
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

  const explicitTopic = toExplicitTopicCommand(text);

  if (explicitTopic === "roadmap") {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: asImprovementRoadmapText()
    });
    return;
  }

  if (explicitTopic === "access") {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: asAccessPlanText(context)
    });
    return;
  }

  if (explicitTopic) {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: asTopicPlanText(explicitTopic)
    });
    return;
  }

  if (input.replyGenerator) {
    let threadMessages: AssistantReplyInput["threadMessages"] = [];

    try {
      threadMessages = await input.slackApi.fetchThreadMessages({
        channelId: assistantRef.channelId,
        threadTs: assistantRef.threadTs
      });
    } catch (error) {
      console.error("[assistant-events] Failed to fetch thread context for LLM reply; continuing without history", {
        phase: "fetch_thread",
        channelId: assistantRef.channelId,
        threadTs: assistantRef.threadTs,
        sourceChannelId: context?.sourceChannelId,
        teamId: context?.teamId,
        inputTextLength: text.length,
        error: describeError(error)
      });
    }

    let phase: "generate_reply" | "post_reply" = "generate_reply";
    try {
      const llmReply = await input.replyGenerator.generateReply({
        text,
        sourceChannelId: context?.sourceChannelId,
        teamId: context?.teamId,
        threadMessages
      });

      phase = "post_reply";
      await input.slackApi.postThreadReply({
        channelId: assistantRef.channelId,
        threadTs: assistantRef.threadTs,
        text: llmReply
      });
      return;
    } catch (error) {
      console.error("[assistant-events] LLM reply path failed", {
        phase,
        channelId: assistantRef.channelId,
        threadTs: assistantRef.threadTs,
        sourceChannelId: context?.sourceChannelId,
        teamId: context?.teamId,
        inputTextLength: text.length,
        threadMessagesLength: threadMessages.length,
        error: describeError(error)
      });

      await input.slackApi.postThreadReply({
        channelId: assistantRef.channelId,
        threadTs: assistantRef.threadTs,
        text:
          "I hit an LLM error while drafting a response. Please try again, or ask for `roadmap` or `access` for deterministic guidance."
      });
      return;
    }
  }

  const inferredTopic = toImprovementTopic(text);

  if (inferredTopic === "roadmap") {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: asImprovementRoadmapText()
    });
    return;
  }

  if (inferredTopic === "access") {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: asAccessPlanText(context)
    });
    return;
  }

  if (inferredTopic) {
    await input.slackApi.postThreadReply({
      channelId: assistantRef.channelId,
      threadTs: assistantRef.threadTs,
      text: asTopicPlanText(inferredTopic)
    });
    return;
  }

  await input.slackApi.postThreadReply({
    channelId: assistantRef.channelId,
    threadTs: assistantRef.threadTs,
    text: [
      "LLM chat is currently disabled. Set `AI_GATEWAY_API_KEY` in the API/workflow runtime environment.",
      "",
      "You can still use deterministic commands: `roadmap`, `memory`, `integrations`, `workflows`, `quality`, `access`."
    ].join("\n")
  });
}

export async function handleSlackAssistantEventJob(
  deps: SlackAssistantEventJobDeps,
  job: SlackAssistantEventJobPayload
): Promise<void> {
  const event = readObject(job.event);
  if (!event) {
    return;
  }

  const eventType = readString(event.type);

  if (eventType === "assistant_thread_started") {
    await handleAssistantThreadStartedEvent({
      event,
      slackApi: deps.slackApi
    });
    return;
  }

  if (eventType === "assistant_thread_context_changed") {
    await handleAssistantThreadContextChangedEvent({
      event,
      slackApi: deps.slackApi
    });
    return;
  }

  if (isAssistantMessageEvent(event)) {
    await handleAssistantMessageEvent({
      event,
      slackApi: deps.slackApi,
      replyGenerator: deps.replyGenerator
    });
  }
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

  const eventId = readString(envelope.event_id);
  if (eventId && !tryStartEvent(eventId)) {
    return okResponse();
  }

  if (deps.enqueueAssistantEventJob) {
    try {
      await deps.enqueueAssistantEventJob({
        event,
        eventId
      });

      if (eventId) {
        markEventDone(eventId);
      }
    } catch {
      if (eventId) {
        markEventFailed(eventId);
      }

      return new Response("Failed to queue assistant event", { status: 500 });
    }

    return okResponse();
  }

  try {
    await handleSlackAssistantEventJob(
      {
        slackApi: deps.slackApi,
        replyGenerator: deps.replyGenerator
      },
      {
        event,
        eventId
      }
    );

    if (eventId) {
      markEventDone(eventId);
    }
  } catch {
    if (eventId) {
      markEventFailed(eventId);
    }
  }

  return okResponse();
}
