import { createHash } from "node:crypto";

import { handleThreadSummaryCommand, type ThreadSummaryWorkflowDispatcher } from "@kwielford/app";
import { getUserBySlackUserId, getWorkspaceBySlackTeamId, type DbClient } from "@kwielford/db";

import { extractThreadReference, parseSlashCommandFormBody } from "../parsers/slash-command.js";
import { verifySlackSignature } from "../security/verify-slack-signature.js";

interface SlackImmediateResponse {
  response_type: "ephemeral" | "in_channel";
  text: string;
}

export interface SlackThreadSummaryCommandInboundDeps {
  db: DbClient;
  workflow: ThreadSummaryWorkflowDispatcher;
  signingSecret: string;
  allowedSlashCommands: string[];
  defaultWorkspaceId?: string;
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
  db: DbClient;
  teamId?: string;
  defaultWorkspaceId?: string;
}): Promise<string | undefined> {
  if (input.teamId) {
    const workspace = await getWorkspaceBySlackTeamId(input.db, input.teamId);
    if (workspace) {
      return workspace.id;
    }
  }

  return input.defaultWorkspaceId;
}

async function resolveInitiatedByUserId(input: {
  db: DbClient;
  workspaceId: string;
  slackUserId?: string;
}): Promise<string | undefined> {
  if (!input.slackUserId) {
    return undefined;
  }

  const user = await getUserBySlackUserId(input.db, input.workspaceId, input.slackUserId);
  return user?.id;
}

function isAllowedCommand(command: string | undefined, allowedCommands: string[]): boolean {
  if (!command) {
    return false;
  }

  return allowedCommands.includes(command);
}

export async function handleSlackThreadSummaryCommandInboundRequest(
  deps: SlackThreadSummaryCommandInboundDeps,
  request: Request
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "POST"
      }
    });
  }

  const rawBody = await request.text();

  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");

  const verified = verifySlackSignature({
    signingSecret: deps.signingSecret,
    rawBody,
    signature,
    timestamp
  });

  if (!verified) {
    return new Response("Invalid Slack signature", { status: 401 });
  }

  const form = parseSlashCommandFormBody(rawBody);

  if (!isAllowedCommand(form.command, deps.allowedSlashCommands)) {
    return jsonResponse(200, {
      response_type: "ephemeral",
      text: `Unsupported command. Allowed: ${deps.allowedSlashCommands.join(", ")}`
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
      db: deps.db,
      teamId: form.team_id,
      defaultWorkspaceId: deps.defaultWorkspaceId
    });

    if (!workspaceId) {
      return jsonResponse(200, {
        response_type: "ephemeral",
        text: "Workspace is not configured. Set DEFAULT_WORKSPACE_ID or map this Slack team in the database."
      });
    }

    const commandId = toCommandId(rawBody);
    const initiatedByUserId = await resolveInitiatedByUserId({
      db: deps.db,
      workspaceId,
      slackUserId: form.user_id
    });

    const ack = await handleThreadSummaryCommand(
      {
        db: deps.db,
        workflow: deps.workflow
      },
      {
        workspaceId,
        channelId: resolved.channelId,
        threadTs: resolved.threadTs,
        commandId,
        triggerSource: "slack",
        actorType: "slack",
        initiatedByUserId,
        actorId: form.user_id
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
