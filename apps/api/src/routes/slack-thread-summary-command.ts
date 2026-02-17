import { createHash } from "node:crypto";

import { createDb, getWorkspaceBySlackTeamId } from "@kweilford/db";
import {
  extractThreadReference,
  handleThreadSummaryCommand,
  parseSlashCommandFormBody,
  verifySlackSignature
} from "@kweilford/slack";

import { VercelWorkflowThreadSummaryDispatcher } from "../adapters/vercel-workflow-thread-summary-dispatcher.js";
import { getApiConfig } from "../env.js";

interface SlackImmediateResponse {
  response_type: "ephemeral" | "in_channel";
  text: string;
}

function jsonResponse(status: number, body: SlackImmediateResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function toCommandId(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

function resolveThreadTsAndChannel(input: {
  rawText?: string;
  fallbackChannelId?: string;
  fallbackThreadTs?: string;
}): { threadTs?: string; channelId?: string } {
  const extracted = extractThreadReference(input.rawText);

  return {
    threadTs: extracted.threadTs ?? input.fallbackThreadTs,
    channelId: extracted.channelId ?? input.fallbackChannelId
  };
}

async function resolveWorkspaceId(input: {
  teamId?: string;
  defaultWorkspaceId?: string;
}): Promise<string | undefined> {
  const db = createDb();

  if (input.teamId) {
    const workspace = await getWorkspaceBySlackTeamId(db, input.teamId);
    if (workspace) {
      return workspace.id;
    }
  }

  return input.defaultWorkspaceId;
}

function isAllowedCommand(command: string | undefined, allowedCommands: string[]): boolean {
  if (!command) {
    return false;
  }

  return allowedCommands.includes(command);
}

export async function handleSlackThreadSummaryCommandRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST"
      }
    });
  }

  const rawBody = await request.text();
  const config = getApiConfig();

  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");

  const verified = verifySlackSignature({
    signingSecret: config.slackSigningSecret,
    rawBody,
    signature,
    timestamp
  });

  if (!verified) {
    return new Response("Invalid Slack signature", { status: 401 });
  }

  const form = parseSlashCommandFormBody(rawBody);

  if (!isAllowedCommand(form.command, config.allowedSlashCommands)) {
    return jsonResponse(200, {
      response_type: "ephemeral",
      text: `Unsupported command. Allowed: ${config.allowedSlashCommands.join(", ")}`
    });
  }

  const resolved = resolveThreadTsAndChannel({
    rawText: form.text,
    fallbackChannelId: form.channel_id,
    fallbackThreadTs: form.thread_ts
  });

  if (!resolved.threadTs || !resolved.channelId) {
    return jsonResponse(200, {
      response_type: "ephemeral",
      text: "Please provide a Slack thread permalink or thread timestamp in the command text."
    });
  }

  try {
    const workspaceId = await resolveWorkspaceId({
      teamId: form.team_id,
      defaultWorkspaceId: config.defaultWorkspaceId
    });

    if (!workspaceId) {
      return jsonResponse(200, {
        response_type: "ephemeral",
        text: "Workspace is not configured. Set DEFAULT_WORKSPACE_ID or map this Slack team in the database."
      });
    }

    const db = createDb();
    const workflow = new VercelWorkflowThreadSummaryDispatcher();
    const commandId = toCommandId(rawBody);

    const ack = await handleThreadSummaryCommand(
      {
        db,
        workflow
      },
      {
        workspaceId,
        channelId: resolved.channelId,
        threadTs: resolved.threadTs,
        commandId,
        userId: form.user_id
      }
    );

    return jsonResponse(200, {
      response_type: "ephemeral",
      text: `${ack.responseText} (run: ${ack.runId})`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown command handling error";
    return jsonResponse(200, {
      response_type: "ephemeral",
      text: `Failed to queue summary: ${message}`
    });
  }
}
