# @kwielford/api

API package for Kwielford Slack assistant events.

## Slack AI assistant events

API route wrapper:

- `src/routes/slack-assistant-events.ts`

Slack inbound handler:

- `apps/slack/src/inbound/assistant-events-handler.ts`

## Environment variables

- `DATABASE_URL`
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`

## Scripts

- `pnpm --filter @kwielford/api dev`
- `pnpm --filter @kwielford/api build`
- `pnpm --filter @kwielford/api test:assistant-event`
