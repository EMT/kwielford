# Slack Assistant Setup

Status date: 2026-02-18

## Purpose

Configure Slack so Kwielford can:

1. Chat about improving Kwielford.
2. Guide phased access expansion across channels and systems.

## Required Routes

- `apps/api/app/api/slack/assistant/events/route.ts`
- Request URL: `https://<your-domain>/api/slack/assistant/events`

## Required Environment Variables

- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`

## Optional LLM Environment Variables

- `LLM_API_KEY` (required for AI-generated free-form chat responses)
- `LLM_MODEL` (default: `gpt-4.1-mini`)
- `LLM_BASE_URL` (default: `https://api.openai.com/v1`)
- `LLM_TIMEOUT_MS` (default: `20000`)
- `LLM_TEMPERATURE` (default: `0.2`)

## Slack App Configuration

1. Enable AI assistant view.
2. Configure bot events:
- `assistant_thread_started`
- `assistant_thread_context_changed`
- `message.im`
3. Set interactivity request URL to the same assistant events endpoint.
4. Keep event processing asynchronous with Vercel Workflows: the API route ACKs quickly and event jobs run in workflow workers.

## Local Smoke Test

- `pnpm --filter @kwielford/api dev`
- `SLACK_SIGNING_SECRET=<secret> pnpm --filter @kwielford/api test:assistant-event`
