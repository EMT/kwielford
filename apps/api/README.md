# @kwielford/api

API and workflow integration package for Kwielford.

## Thread summary slash command

Primary handler:

- `src/routes/slack-thread-summary-command.ts`

## Slack AI assistant events

Primary handler:

- `src/routes/slack-assistant-events.ts`

Vercel-style wrapper (re-exported):

- `src/vercel-routes/slack-thread-summary-command.ts`

## Workflow

Thread summary workflow entrypoint:

- `src/workflows/thread-summary-workflow.ts`

Dispatcher implementation:

- `src/adapters/vercel-workflow-thread-summary-dispatcher.ts`

## Environment variables

- `DATABASE_URL`
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `SLACK_ALLOWED_COMMANDS` (optional)
- `DEFAULT_WORKSPACE_ID` (optional)

## Scripts

- `pnpm --filter @kwielford/api dev`
- `pnpm --filter @kwielford/api build`
- `pnpm --filter @kwielford/api test:slash-command`
- `pnpm --filter @kwielford/api test:assistant-event`
