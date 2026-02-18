import { relations, sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const agentTaskKindEnum = pgEnum("agent_task_kind", [
  "draft_client_reply",
  "follow_up_extraction",
  "follow_up_item"
]);

export const agentTaskStatusEnum = pgEnum("agent_task_status", [
  "open",
  "in_progress",
  "completed",
  "failed",
  "cancelled"
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled"
]);

export const messageSourceEnum = pgEnum("message_source", ["slack", "cli", "api", "system"]);

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system", "tool"]);

export const auditActorTypeEnum = pgEnum("audit_actor_type", ["system", "user", "slack", "cli", "api"]);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    slackTeamId: text("slack_team_id"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("workspaces_slug_uidx").on(table.slug),
    uniqueIndex("workspaces_slack_team_uidx").on(table.slackTeamId)
  ]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slackUserId: text("slack_user_id"),
    email: text("email"),
    displayName: text("display_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("users_workspace_slack_uidx").on(table.workspaceId, table.slackUserId),
    index("users_workspace_idx").on(table.workspaceId)
  ]
);

export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    kind: agentTaskKindEnum("kind").notNull(),
    status: agentTaskStatusEnum("status").notNull().default("open"),
    title: text("title").notNull(),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("agent_tasks_workspace_idx").on(table.workspaceId),
    index("agent_tasks_workspace_status_idx").on(table.workspaceId, table.status),
    index("agent_tasks_due_at_idx").on(table.dueAt)
  ]
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => agentTasks.id, { onDelete: "set null" }),
    initiatedByUserId: uuid("initiated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    triggerSource: messageSourceEnum("trigger_source").notNull().default("system"),
    taskKind: agentTaskKindEnum("task_kind").notNull(),
    status: agentRunStatusEnum("status").notNull().default("queued"),
    idempotencyKey: text("idempotency_key"),
    input: jsonb("input")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    output: jsonb("output")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    errorText: text("error_text"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("agent_runs_workspace_idempotency_uidx").on(table.workspaceId, table.idempotencyKey),
    index("agent_runs_workspace_status_idx").on(table.workspaceId, table.status),
    index("agent_runs_workspace_created_idx").on(table.workspaceId, table.createdAt)
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    source: messageSourceEnum("source").notNull().default("system"),
    role: messageRoleEnum("role").notNull(),
    channelId: text("channel_id"),
    threadTs: text("thread_ts"),
    externalMessageId: text("external_message_id"),
    content: text("content").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex("messages_workspace_source_external_uidx").on(
      table.workspaceId,
      table.source,
      table.externalMessageId
    ),
    index("messages_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("messages_run_idx").on(table.runId)
  ]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"),
    eventName: text("event_name").notNull(),
    eventData: jsonb("event_data")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt()
  },
  (table) => [
    index("audit_events_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("audit_events_run_idx").on(table.runId)
  ]
);

export const workspaceRelations = relations(workspaces, ({ many }) => ({
  users: many(users),
  agentTasks: many(agentTasks),
  agentRuns: many(agentRuns),
  messages: many(messages),
  auditEvents: many(auditEvents)
}));

export const userRelations = relations(users, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [users.workspaceId],
    references: [workspaces.id]
  }),
  createdTasks: many(agentTasks),
  initiatedRuns: many(agentRuns),
  messages: many(messages),
  auditEvents: many(auditEvents)
}));

export const agentTaskRelations = relations(agentTasks, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [agentTasks.workspaceId],
    references: [workspaces.id]
  }),
  createdByUser: one(users, {
    fields: [agentTasks.createdByUserId],
    references: [users.id]
  }),
  runs: many(agentRuns)
}));

export const agentRunRelations = relations(agentRuns, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [agentRuns.workspaceId],
    references: [workspaces.id]
  }),
  task: one(agentTasks, {
    fields: [agentRuns.taskId],
    references: [agentTasks.id]
  }),
  initiatedByUser: one(users, {
    fields: [agentRuns.initiatedByUserId],
    references: [users.id]
  }),
  messages: many(messages),
  auditEvents: many(auditEvents)
}));

export const messageRelations = relations(messages, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [messages.workspaceId],
    references: [workspaces.id]
  }),
  run: one(agentRuns, {
    fields: [messages.runId],
    references: [agentRuns.id]
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id]
  })
}));

export const auditEventRelations = relations(auditEvents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [auditEvents.workspaceId],
    references: [workspaces.id]
  }),
  run: one(agentRuns, {
    fields: [auditEvents.runId],
    references: [agentRuns.id]
  }),
  user: one(users, {
    fields: [auditEvents.userId],
    references: [users.id]
  })
}));

export type Workspace = InferSelectModel<typeof workspaces>;
export type NewWorkspace = InferInsertModel<typeof workspaces>;
export type AgentTaskKind = (typeof agentTaskKindEnum.enumValues)[number];
export type AgentTaskStatus = (typeof agentTaskStatusEnum.enumValues)[number];
export type AgentRunStatus = (typeof agentRunStatusEnum.enumValues)[number];
export type MessageSource = (typeof messageSourceEnum.enumValues)[number];
export type MessageRole = (typeof messageRoleEnum.enumValues)[number];
export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type AgentTask = InferSelectModel<typeof agentTasks>;
export type NewAgentTask = InferInsertModel<typeof agentTasks>;
export type AgentRun = InferSelectModel<typeof agentRuns>;
export type NewAgentRun = InferInsertModel<typeof agentRuns>;
export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;
export type AuditEvent = InferSelectModel<typeof auditEvents>;
export type NewAuditEvent = InferInsertModel<typeof auditEvents>;
