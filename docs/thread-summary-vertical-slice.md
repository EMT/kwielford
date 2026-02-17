# Thread Summary Vertical Slice

Status date: 2026-02-17

This vertical slice scaffolds the end-to-end flow:

1. Slack command accepted quickly (`ack` behavior).
2. Run record created in Postgres with idempotency key.
3. Async job dispatched (workflow interface).
4. Thread content summarized by shared core task logic.
5. Output persisted to `agent_runs` and `messages`.
6. Audit events persisted for success/failure.
7. Reply posted back to Slack thread (responder interface).

## Modules

- Core summarizer:
  - `packages/core/src/tasks/thread-summary.ts`
- DB repositories:
  - `packages/db/src/repositories.ts`
- Slack orchestration:
  - `apps/slack/src/flows/thread-summary-flow.ts`
- Slack API/signature adapters:
  - `apps/slack/src/adapters/slack-web-api.ts`
  - `apps/slack/src/security/verify-slack-signature.ts`
  - `apps/slack/src/parsers/slash-command.ts`
- API command + workflow wiring:
  - `apps/api/src/routes/slack-thread-summary-command.ts`
  - `apps/api/src/adapters/vercel-workflow-thread-summary-dispatcher.ts`
  - `apps/api/src/workflows/thread-summary-workflow.ts`

## Integration Interfaces

The flow is intentionally adapter-based to keep business logic testable:

- `ThreadSummaryWorkflowDispatcher`
- `ThreadSummaryMessageFetcher`
- `ThreadSummarySlackResponder`

Implemented with:

- Vercel Workflow dispatch (`workflow/api start(...)`).
- Slack Web API calls for thread fetch + reply post.

## Remaining Wiring Targets

- Bind a production Vercel route URL to `handleSlackThreadSummaryCommandRequest`.
- Configure Slack slash command to call that route.
- Seed workspace mapping (`slack_team_id`) or set `DEFAULT_WORKSPACE_ID`.
