import { and, eq } from "drizzle-orm";

import type { DbClient } from "./client.js";
import {
  agentRuns,
  auditEvents,
  messages,
  users,
  workspaces,
  type AgentRun,
  type AgentRunStatus,
  type Message,
  type MessageRole,
  type MessageSource,
  type NewAgentRun,
  type NewAuditEvent,
  type NewMessage,
  type User,
  type Workspace
} from "./schema.js";

export interface CreateAgentRunInput {
  workspaceId: string;
  taskId?: string | null;
  initiatedByUserId?: string | null;
  triggerSource: MessageSource;
  taskKind: NewAgentRun["taskKind"];
  idempotencyKey?: string | null;
  input: Record<string, unknown>;
}

export interface UpdateAgentRunStateInput {
  status: AgentRunStatus;
  output?: Record<string, unknown>;
  errorText?: string | null;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateMessageInput {
  workspaceId: string;
  runId?: string | null;
  userId?: string | null;
  source: MessageSource;
  role: MessageRole;
  channelId?: string | null;
  threadTs?: string | null;
  externalMessageId?: string | null;
  content: string;
  payload?: Record<string, unknown>;
}

export interface CreateAuditEventInput {
  workspaceId: string;
  runId?: string | null;
  userId?: string | null;
  actorType: NewAuditEvent["actorType"];
  actorId?: string | null;
  eventName: string;
  eventData?: Record<string, unknown>;
}

export async function getAgentRunByIdempotencyKey(
  db: DbClient,
  workspaceId: string,
  idempotencyKey: string
): Promise<AgentRun | undefined> {
  const rows = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.idempotencyKey, idempotencyKey)))
    .limit(1);

  return rows[0];
}

export async function createAgentRun(db: DbClient, input: CreateAgentRunInput): Promise<AgentRun> {
  if (input.idempotencyKey) {
    const existing = await getAgentRunByIdempotencyKey(db, input.workspaceId, input.idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  const rows = await db
    .insert(agentRuns)
    .values({
      workspaceId: input.workspaceId,
      taskId: input.taskId ?? null,
      initiatedByUserId: input.initiatedByUserId ?? null,
      triggerSource: input.triggerSource,
      taskKind: input.taskKind,
      status: "queued",
      idempotencyKey: input.idempotencyKey ?? null,
      input: input.input,
      output: {}
    })
    .returning();

  const run = rows[0];
  if (!run) {
    throw new Error("Failed to create agent run.");
  }

  return run;
}

export async function updateAgentRunState(
  db: DbClient,
  runId: string,
  update: UpdateAgentRunStateInput
): Promise<AgentRun> {
  const rows = await db
    .update(agentRuns)
    .set({
      status: update.status,
      output: update.output,
      errorText: update.errorText,
      startedAt: update.startedAt,
      completedAt: update.completedAt,
      updatedAt: new Date()
    })
    .where(eq(agentRuns.id, runId))
    .returning();

  const run = rows[0];
  if (!run) {
    throw new Error(`Agent run not found: ${runId}`);
  }

  return run;
}

export async function createMessage(db: DbClient, input: CreateMessageInput): Promise<Message> {
  const rows = await db
    .insert(messages)
    .values({
      workspaceId: input.workspaceId,
      runId: input.runId ?? null,
      userId: input.userId ?? null,
      source: input.source,
      role: input.role,
      channelId: input.channelId ?? null,
      threadTs: input.threadTs ?? null,
      externalMessageId: input.externalMessageId ?? null,
      content: input.content,
      payload: input.payload ?? {}
    } satisfies NewMessage)
    .returning();

  const message = rows[0];
  if (!message) {
    throw new Error("Failed to create message.");
  }

  return message;
}

export async function createAuditEvent(db: DbClient, input: CreateAuditEventInput): Promise<void> {
  await db.insert(auditEvents).values({
    workspaceId: input.workspaceId,
    runId: input.runId ?? null,
    userId: input.userId ?? null,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    eventName: input.eventName,
    eventData: input.eventData ?? {}
  });
}

export async function getWorkspaceBySlackTeamId(db: DbClient, slackTeamId: string): Promise<Workspace | undefined> {
  const rows = await db.select().from(workspaces).where(eq(workspaces.slackTeamId, slackTeamId)).limit(1);
  return rows[0];
}

export async function getUserBySlackUserId(
  db: DbClient,
  workspaceId: string,
  slackUserId: string
): Promise<User | undefined> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.workspaceId, workspaceId), eq(users.slackUserId, slackUserId)))
    .limit(1);

  return rows[0];
}
