# Slack + Vercel Workflow Setup

Status date: 2026-02-17

Project/team naming note:
- GitHub org is `EMT` while Vercel team scope is `fieldwork`.
- See `docs/project-context.md` for canonical platform identifiers.

## What is implemented

- Slash command verification and parsing.
- Fast command ack + async workflow dispatch.
- Workflow job execution that:
  - fetches Slack thread messages,
  - summarizes the thread,
  - writes run/message/audit records,
  - posts a reply to the same thread.
- Assistant events endpoint for Slack AI Apps that:
  - handles Slack URL verification,
  - initializes assistant thread prompts/title,
  - accepts `message.im` events and queues thread summaries from permalinks.

## Key modules

- Command route handler:
  - `apps/api/src/routes/slack-thread-summary-command.ts`
- Assistant events route handler:
  - `apps/api/src/routes/slack-assistant-events.ts`
- Vercel Workflow dispatcher:
  - `apps/api/src/adapters/vercel-workflow-thread-summary-dispatcher.ts`
- Workflow function:
  - `apps/api/src/workflows/thread-summary-workflow.ts`
- Slack API adapter:
  - `apps/slack/src/adapters/slack-web-api.ts`
- Slack signature verifier:
  - `apps/slack/src/security/verify-slack-signature.ts`

## Required environment variables

- `DATABASE_URL`
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`

Optional:

- `SLACK_ALLOWED_COMMANDS` (default: `/kwielford-summary`)
- `DEFAULT_WORKSPACE_ID` (fallback workspace if team mapping is not in DB)

## Deploy route structure (Vercel + Next.js)

Route files:

- `apps/api/app/api/slack/thread-summary/route.ts`
- `apps/api/app/api/slack/assistant/events/route.ts`
- `apps/api/app/api/health/route.ts`
- `apps/api/next.config.ts` (`withWorkflow(...)` enabled)

Deploy `apps/api` as a Vercel project. The slash command URL should be:

- `https://<your-domain>/api/slack/thread-summary`
- `https://<your-domain>/api/slack/assistant/events` (AI app events + URL verification)

## Slack app setup

1. Create a slash command, for example `/kwielford-summary`.
2. Point the command request URL to your deployed command endpoint.
3. Add bot scopes needed for this flow:
   - `channels:history` (or matching conversation history scope)
   - `chat:write`
4. Install/reinstall app to workspace and copy bot token.

## Slack AI app setup

Use the manifest template:

- `apps/slack/manifest.ai-assistant.yaml`

Before applying the manifest, replace:

- `redirect_urls[0]`
- `settings.event_subscriptions.request_url`
- `settings.interactivity.request_url`

Required bot scopes for assistant flow:

- `assistant:write`
- `chat:write`
- `channels:history`
- `groups:history`
- `im:history`
- `mpim:history`

Required bot events:

- `assistant_thread_started`
- `assistant_thread_context_changed`
- `message.im`

Current assistant behavior:

- In the assistant thread, send a thread permalink.
- The assistant queues the same thread-summary workflow used by the slash command.
- Summary output is posted back into the original Slack thread.

## Vercel routing note

The command logic is framework-agnostic as a function:

- `handleSlackThreadSummaryCommandRequest(request: Request): Promise<Response>`

You can wrap this in your framework route handler. A convenience wrapper is included:

- `apps/api/src/vercel-routes/slack-thread-summary-command.ts`

## Current behavior requirement

The slash command input must include either:

- a Slack thread permalink, or
- a thread timestamp in `1234567890.123456` format.

## Local signed request test

1. Start API app:
   - `pnpm --filter @kwielford/api dev`
2. In another terminal, run:
   - `SLACK_SIGNING_SECRET=<your-secret> pnpm --filter @kwielford/api test:slash-command`

The helper script signs a form-encoded slash command payload and posts it to:

- `http://localhost:3000/api/slack/thread-summary` (override with `TEST_URL`)

Local assistant event test:

- `SLACK_SIGNING_SECRET=<your-secret> pnpm --filter @kwielford/api test:assistant-event`
- Default target URL:
  - `http://localhost:3000/api/slack/assistant/events` (override with `TEST_URL`)

## Next integration step

Run these commands after setting env vars:

1. `pnpm --filter @kwielford/db db:migrate`
2. `SEED_WORKSPACE_NAME=Fieldwork SEED_WORKSPACE_SLUG=fieldwork SEED_SLACK_TEAM_ID=<T...> pnpm --filter @kwielford/db db:seed`
3. Deploy `apps/api` to Vercel and set the same env vars in Vercel project settings.
