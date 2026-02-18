#!/usr/bin/env node

import { createHmac } from "node:crypto";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const signingSecret = requiredEnv("SLACK_SIGNING_SECRET");
const url = process.env.TEST_URL ?? "http://localhost:3000/api/slack/assistant/events";
const timestamp = Math.floor(Date.now() / 1000).toString();

const payload = {
  token: process.env.TEST_TOKEN ?? "test-token",
  team_id: process.env.TEST_TEAM_ID ?? "T123456",
  api_app_id: process.env.TEST_APP_ID ?? "A123456",
  type: "event_callback",
  event_id: process.env.TEST_EVENT_ID ?? `Ev${Date.now()}`,
  event_time: Number.parseInt(timestamp, 10),
  event: {
    type: "message",
    channel_type: "im",
    channel: process.env.TEST_ASSISTANT_CHANNEL_ID ?? "D123456",
    user: process.env.TEST_USER_ID ?? "U123456",
    text:
      process.env.TEST_TEXT ??
      "Help us make you better. Give me a phased access rollout across Slack channels and tools.",
    ts: process.env.TEST_EVENT_TS ?? "1739999999.000200",
    thread_ts: process.env.TEST_ASSISTANT_THREAD_TS ?? "1739999999.000200"
  }
};

const body = JSON.stringify(payload);
const baseString = `v0:${timestamp}:${body}`;
const signature = `v0=${createHmac("sha256", signingSecret).update(baseString).digest("hex")}`;

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Slack-Request-Timestamp": timestamp,
    "X-Slack-Signature": signature
  },
  body
});

const text = await response.text();
console.log(`status=${response.status}`);
console.log(text);
