# Slack + Vercel Workflow Setup

Status date: 2026-02-17

## What is implemented

- Slash command verification and parsing.
- Fast command ack + async workflow dispatch.
- Workflow job execution that:
  - fetches Slack thread messages,
  - summarizes the thread,
  - writes run/message/audit records,
  - posts a reply to the same thread.

## Key modules

- Command route handler:
  - `apps/api/src/routes/slack-thread-summary-command.ts`
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

- `SLACK_ALLOWED_COMMANDS` (default: `/kweilford-summary`)
- `DEFAULT_WORKSPACE_ID` (fallback workspace if team mapping is not in DB)

## Deploy route structure (Vercel + Next.js)

Route files:

- `apps/api/app/api/slack/thread-summary/route.ts`
- `apps/api/app/api/health/route.ts`
- `apps/api/next.config.ts` (`withWorkflow(...)` enabled)

Deploy `apps/api` as a Vercel project. The slash command URL should be:

- `https://<your-domain>/api/slack/thread-summary`

## Slack app setup

1. Create a slash command, for example `/kweilford-summary`.
2. Point the command request URL to your deployed command endpoint.
3. Add bot scopes needed for this flow:
   - `channels:history` (or matching conversation history scope)
   - `chat:write`
4. Install/reinstall app to workspace and copy bot token.

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
   - `pnpm --filter @kweilford/api dev`
2. In another terminal, run:
   - `SLACK_SIGNING_SECRET=<your-secret> pnpm --filter @kweilford/api test:slash-command`

The helper script signs a form-encoded slash command payload and posts it to:

- `http://localhost:3000/api/slack/thread-summary` (override with `TEST_URL`)

## Next integration step

Run these commands after setting env vars:

1. `pnpm --filter @kweilford/db db:migrate`
2. `SEED_WORKSPACE_NAME=Fieldwork SEED_WORKSPACE_SLUG=fieldwork SEED_SLACK_TEAM_ID=<T...> pnpm --filter @kweilford/db db:seed`
3. Deploy `apps/api` to Vercel and set the same env vars in Vercel project settings.
