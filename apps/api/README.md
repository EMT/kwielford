# @kweilford/api

API and workflow integration package for Kweilford.

## Thread summary slash command

Primary handler:

- `src/routes/slack-thread-summary-command.ts`

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

- `pnpm --filter @kweilford/api dev`
- `pnpm --filter @kweilford/api build`
- `pnpm --filter @kweilford/api test:slash-command`
