# @kwielford/api

API and workflow integration package for Kwielford.

Architecture reference:
- `docs/channel-agnostic-architecture.md` defines Slack as a channel adapter and the cross-channel boundaries.

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
- `AI_GATEWAY_API_KEY` (optional, enables LLM thread summarization)
- `AI_GATEWAY_MODEL` (optional, default: `openai/gpt-4.1-mini`)
- `AI_GATEWAY_BASE_URL` (optional, default: `https://ai-gateway.vercel.sh/v1`)
- `AI_SUMMARY_TIMEOUT_MS` (optional, default: `20000`)

## Scripts

- `pnpm --filter @kwielford/api dev`
- `pnpm --filter @kwielford/api build`
- `pnpm --filter @kwielford/api test:slash-command`
- `pnpm --filter @kwielford/api test:assistant-event`
