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
const url = process.env.TEST_URL ?? "http://localhost:3000/api/slack/thread-summary";
const timestamp = Math.floor(Date.now() / 1000).toString();

const form = new URLSearchParams({
  token: process.env.TEST_TOKEN ?? "test-token",
  team_id: process.env.TEST_TEAM_ID ?? "T123456",
  team_domain: process.env.TEST_TEAM_DOMAIN ?? "fieldwork",
  channel_id: process.env.TEST_CHANNEL_ID ?? "C123456",
  channel_name: process.env.TEST_CHANNEL_NAME ?? "general",
  user_id: process.env.TEST_USER_ID ?? "U123456",
  user_name: process.env.TEST_USER_NAME ?? "tester",
  command: process.env.TEST_COMMAND ?? "/kwielford-summary",
  text:
    process.env.TEST_TEXT ??
    "https://fieldwork.slack.com/archives/C123456/p1739999999000100?thread_ts=1739999999.000100&cid=C123456",
  response_url: process.env.TEST_RESPONSE_URL ?? "https://example.com/response",
  trigger_id: process.env.TEST_TRIGGER_ID ?? "13345224609.738474920.8088930838d88f008e0"
});

const body = form.toString();
const baseString = `v0:${timestamp}:${body}`;
const signature = `v0=${createHmac("sha256", signingSecret).update(baseString).digest("hex")}`;

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Slack-Request-Timestamp": timestamp,
    "X-Slack-Signature": signature
  },
  body
});

const text = await response.text();
console.log(`status=${response.status}`);
console.log(text);
