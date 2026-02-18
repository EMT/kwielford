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

## Slack App Configuration

1. Enable AI assistant view.
2. Configure bot events:
- `assistant_thread_started`
- `assistant_thread_context_changed`
- `message.im`
3. Set interactivity request URL to the same assistant events endpoint.

## Local Smoke Test

- `pnpm --filter @kwielford/api dev`
- `SLACK_SIGNING_SECRET=<secret> pnpm --filter @kwielford/api test:assistant-event`
