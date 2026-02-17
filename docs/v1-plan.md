# Kweilford v1 Plan

Status date: 2026-02-17

## 0) Documentation Setup

Goal: establish a single planning source of truth in the repo.

- Create `docs/` directory for project planning and architecture notes.
- Create this document as the initial execution plan.
- Keep key decisions here before they are codified.

## 1) Define v1 Scope (Initial Proposal)

Goal: launch a useful first version for Fieldwork operations through Slack + CLI.

### v1 Tasks (3)

1. Thread Summary
- Input: Slack thread URL or channel+thread timestamp.
- Output: concise summary with decisions, blockers, and next actions.
- Success criteria:
  - End-to-end response in less than 90 seconds for normal threads.
  - Persists run metadata and output to Postgres.
  - Posts summary back to Slack thread when invoked from Slack.

2. Draft Client Reply
- Input: Slack thread context + optional tone instruction.
- Output: draft reply ready to send (never auto-send in v1).
- Success criteria:
  - Produces one primary draft and one shorter alternative.
  - Includes confidence note or assumptions when context is incomplete.
  - Leaves an audit record of prompt/task run.

3. Follow-up Task Extraction
- Input: Slack thread context.
- Output: structured action list (owner, due date if detectable, task text).
- Success criteria:
  - Writes extracted tasks to DB with status `open`.
  - Posts extracted tasks to Slack as checklist-style message.
  - Supports CLI retrieval by run/task id.

### v1 Non-Goals

- No autonomous outbound actions without human approval.
- No multi-workspace enterprise permission model yet.
- No external PM tool sync (Asana/Linear/etc.) in first release.

## 2) Monorepo Skeleton (Initial)

Goal: separate delivery surfaces (Slack, CLI) from shared core logic.

### Directory Structure

```text
apps/
  slack/      # Slack events, commands, signature validation, handlers
  cli/        # Operator/admin command surface
  api/        # Shared HTTP endpoints/webhooks (if needed outside slack app)
packages/
  core/       # Agent orchestration, prompt/tool registry, task runners
  db/         # Drizzle schema, migrations, query layer
  config/     # Env parsing/validation, shared typed config
docs/
  v1-plan.md
```

### Package Responsibilities

- `packages/core`
  - Task contracts and execution pipeline.
  - Shared run state model.
  - Reusable formatting logic for Slack and CLI outputs.

- `packages/db`
  - Drizzle schema and migrations for Neon Postgres.
  - Repository functions for runs, tasks, messages, audit events.

- `packages/config`
  - Runtime env validation (`zod`) and shared config helpers.

- `apps/slack`
  - Slack app entrypoints.
  - Fast ack -> async workflow handoff pattern.
  - Reply posting and retry-safe idempotency.

- `apps/cli`
  - Commands to run tasks, check status, and inspect outputs.

- `apps/api`
  - Optional shared ingestion endpoints and health/status endpoints.

### Initial Tooling Decisions

- Package manager: `pnpm` (selected).

## Immediate Next Implementation Steps

1. Initialize workspace tooling (pnpm + TypeScript project references). (completed)
2. Define initial DB schema in `packages/db`. (completed)
   - `workspaces`, `users`, `agent_tasks`, `agent_runs`, `messages`, `audit_events`.
3. Build one vertical slice first: "Thread Summary" from Slack invoke to DB write to Slack response. (implemented scaffold)
4. Add CLI command for the same task runner to prove shared core reuse. (implemented scaffold)

### DB Schema Notes (Implemented)

- Added Drizzle schema with core enums and the six initial tables.
- Added indexed relationships for workspace-scoped querying and run/task/message/audit lookups.
- Added idempotency support field on `agent_runs` for Slack retry safety.
- Added Drizzle config and scripts for migration generation and execution.

### Thread Summary Vertical Slice Notes (Implemented Scaffold)

- Added shared thread summarization task logic in `packages/core`.
- Added DB repository helpers for run lifecycle, messages, and audit events in `packages/db`.
- Added Slack flow module with:
  - Fast command handling (`handleThreadSummaryCommand`) that queues async job payloads.
  - Async job executor (`runThreadSummaryJob`) that writes run status, output, message, and audit records.
- Added Slack integration adapters:
  - Signature verification and slash-command parsing.
  - Slack Web API adapter for thread fetch + thread reply post.
- Added Vercel Workflow integration:
  - Dispatcher using `workflow/api` `start(...)`.
  - Workflow function that executes the thread summary job.
- Added deploy-ready Next.js route structure in `apps/api` for:
  - `/api/slack/thread-summary`
  - `/api/health`
- Remaining integration work:
  - Set environment variables in local/Vercel.
  - Run Neon migrate + seed with actual `DATABASE_URL`.
  - Bind Slack slash command Request URL to deployed route.

### CLI Reuse Notes (Implemented Scaffold)

- Added `kweilford thread-summary` command in `apps/cli`.
- Command reads thread message JSON, runs shared `packages/core` summarizer, and prints formatted output.
- Optional persistence (`--workspace-id`) writes run/message/audit records via shared `packages/db` repository functions.

## Open Decisions (to finalize before coding deep)

- Framework for runtime endpoints on Vercel: native route handlers vs lightweight server wrapper.
- Naming and UX for the first slash command(s).
