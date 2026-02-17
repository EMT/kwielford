# Slack AI Assistant Implementation

Status date: 2026-02-17

This document covers the Slack adapter implementation only.
For the product-level architecture boundary, see `docs/channel-agnostic-architecture.md`.

This repo now supports Slack AI app events via:

- `apps/api/app/api/slack/assistant/events/route.ts`
- `apps/api/src/routes/slack-assistant-events.ts`
- `apps/slack/src/inbound/assistant-events-handler.ts`

## Event flow

1. Slack sends `POST /api/slack/assistant/events`.
2. Request signature is verified (`x-slack-signature`, `x-slack-request-timestamp`).
3. `url_verification` payloads return `{ "challenge": ... }`.
4. `assistant_thread_started` and `assistant_thread_context_changed`:
   - store assistant-thread context (best effort, in-memory),
   - set assistant thread title,
   - set suggested prompts.
5. `assistant_thread_started`:
   - posts a kickoff message that starts an "improve Kwielford" planning conversation.
6. `message.im`:
   - ignores bot messages,
   - if no permalink is present, responds with build/setup suggestions to improve assistant usefulness,
   - if permalink is present, resolves workspace by Slack `team_id` (or `DEFAULT_WORKSPACE_ID`),
   - queues existing thread-summary workflow,
   - replies in assistant thread with run id.
7. Workflow summary generation:
   - uses Vercel AI Gateway through AI SDK when `AI_GATEWAY_API_KEY` is set,
   - falls back to deterministic summary extraction if LLM call fails.
8. Workflow posts the final summary back into the source Slack thread.

## Minimal Bolt skeleton (optional alternative)

```ts
import { App } from "@slack/bolt";

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN
});

app.event("assistant_thread_started", async ({ event, client }) => {
  await client.assistant.threads.setTitle({
    channel_id: event.assistant_thread.channel_id,
    thread_ts: event.assistant_thread.thread_ts,
    title: "Kwielford assistant"
  });

  await client.assistant.threads.setSuggestedPrompts({
    channel_id: event.assistant_thread.channel_id,
    thread_ts: event.assistant_thread.thread_ts,
    prompts: [
      {
        title: "Improve Kwielford",
        message: "Help us make you a better assistant. What should we build first?"
      }
    ]
  });

  await client.chat.postMessage({
    channel: event.assistant_thread.channel_id,
    thread_ts: event.assistant_thread.thread_ts,
    text: "Let's make me a better assistant for your team. Ask for `roadmap`, `memory`, `integrations`, `workflows`, or `quality`."
  });
});

app.event("message", async ({ event, client }) => {
  if (event.channel_type !== "im" || event.subtype === "bot_message") {
    return;
  }

  await client.assistant.threads.setStatus({
    channel_id: event.channel,
    thread_ts: event.thread_ts ?? event.ts,
    status: "Queuing thread summary..."
  });

  // Parse permalink and queue the same workflow used in this repo.
});
```

Use this Bolt example only if you later move from the Next.js route handler model to a Bolt runtime.
