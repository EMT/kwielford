export interface SlackSlashCommandPayload {
  token?: string;
  team_id?: string;
  team_domain?: string;
  channel_id?: string;
  channel_name?: string;
  user_id?: string;
  user_name?: string;
  command?: string;
  text?: string;
  response_url?: string;
  trigger_id?: string;
  thread_ts?: string;
}

export interface ParsedThreadReference {
  threadTs?: string;
  channelId?: string;
}

const SLACK_THREAD_URL_PATTERN = /\/archives\/([A-Z0-9]+)\/p(\d{16})/i;
const SLACK_THREAD_TS_QUERY_KEY = "thread_ts";
const THREAD_TS_PATTERN = /^\d{10}\.\d{6}$/;

function decodeThreadTsFromPermalink(value: string): ParsedThreadReference {
  const match = value.match(SLACK_THREAD_URL_PATTERN);
  if (!match) {
    return {};
  }

  const channelId = match[1];
  const packedTs = match[2];
  const threadTs = `${packedTs.slice(0, 10)}.${packedTs.slice(10, 16)}`;

  return { channelId, threadTs };
}

export function parseSlashCommandFormBody(rawBody: string): SlackSlashCommandPayload {
  const params = new URLSearchParams(rawBody);

  return {
    token: params.get("token") ?? undefined,
    team_id: params.get("team_id") ?? undefined,
    team_domain: params.get("team_domain") ?? undefined,
    channel_id: params.get("channel_id") ?? undefined,
    channel_name: params.get("channel_name") ?? undefined,
    user_id: params.get("user_id") ?? undefined,
    user_name: params.get("user_name") ?? undefined,
    command: params.get("command") ?? undefined,
    text: params.get("text") ?? undefined,
    response_url: params.get("response_url") ?? undefined,
    trigger_id: params.get("trigger_id") ?? undefined,
    thread_ts: params.get("thread_ts") ?? undefined
  };
}

export function extractThreadReference(commandText: string | undefined): ParsedThreadReference {
  if (!commandText) {
    return {};
  }

  const trimmed = commandText.trim();
  if (!trimmed) {
    return {};
  }

  if (THREAD_TS_PATTERN.test(trimmed)) {
    return { threadTs: trimmed };
  }

  try {
    const url = new URL(trimmed);
    const queryThreadTs = url.searchParams.get(SLACK_THREAD_TS_QUERY_KEY);
    if (queryThreadTs && THREAD_TS_PATTERN.test(queryThreadTs)) {
      const decoded = decodeThreadTsFromPermalink(trimmed);
      return {
        threadTs: queryThreadTs,
        channelId: decoded.channelId
      };
    }
  } catch {
    // fall through to permalink pattern parsing
  }

  return decodeThreadTsFromPermalink(trimmed);
}
