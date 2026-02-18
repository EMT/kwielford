# @kwielford/api

API package for Kwielford Slack assistant events.

## Slack AI assistant events

API route wrapper:

- `src/routes/slack-assistant-events.ts`

Slack inbound handler:

- `apps/slack/src/inbound/assistant-events-handler.ts`

Workflow dispatcher:

- `src/adapters/vercel-workflow-assistant-event-dispatcher.ts`

Workflow entrypoint:

- `src/workflows/slack-assistant-event-workflow.ts`

## Environment variables

- `DATABASE_URL`
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `AI_GATEWAY_API_KEY` (optional; enables AI-generated free-form chat replies)
- `AI_GATEWAY_MODEL` (optional; default `openai/gpt-4.1-mini`)
- `AI_GATEWAY_BASE_URL` (optional; default `https://ai-gateway.vercel.sh/v1/ai`)
- `AI_GATEWAY_TIMEOUT_MS` (optional; default `20000`)
- `AI_GATEWAY_TEMPERATURE` (optional; default `0.2`)

## Scripts

- `pnpm --filter @kwielford/api dev`
- `pnpm --filter @kwielford/api build`
- `pnpm --filter @kwielford/api test:assistant-event`
