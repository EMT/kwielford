import type { ThreadMessage } from "@kwielford/core";

import type {
  ThreadSummaryMessageFetcher,
  ThreadSummarySlackResponder
} from "../flows/thread-summary-flow.js";

interface SlackApiResponseBase {
  ok: boolean;
  error?: string;
}

interface SlackReplyMessage {
  ts?: string;
  text?: string;
  user?: string;
  bot_id?: string;
}

interface ConversationsRepliesResponse extends SlackApiResponseBase {
  messages?: SlackReplyMessage[];
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

interface ChatPostMessageResponse extends SlackApiResponseBase {
  ts?: string;
}

export interface SlackWebApiAdapterOptions {
  botToken: string;
}

function asErrorMessage(response: SlackApiResponseBase, status: number): string {
  return response.error ? `Slack API error (${status}): ${response.error}` : `Slack API error (${status})`;
}

export class SlackWebApiAdapter implements ThreadSummaryMessageFetcher, ThreadSummarySlackResponder {
  private readonly botToken: string;

  public constructor(options: SlackWebApiAdapterOptions) {
    this.botToken = options.botToken;
  }

  private async callSlackApi<TResponse extends SlackApiResponseBase>(
    method: string,
    payload: Record<string, unknown>
  ): Promise<TResponse> {
    const response = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const json = (await response.json()) as TResponse;

    if (!response.ok || !json.ok) {
      throw new Error(asErrorMessage(json, response.status));
    }

    return json;
  }

  public async fetchThreadMessages(input: {
    workspaceId: string;
    channelId: string;
    threadTs: string;
  }): Promise<ThreadMessage[]> {
    const out: ThreadMessage[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.callSlackApi<ConversationsRepliesResponse>("conversations.replies", {
        channel: input.channelId,
        ts: input.threadTs,
        limit: 200,
        cursor
      });

      const pageMessages = (response.messages ?? [])
        .map((message) => ({
          ts: typeof message.ts === "string" ? message.ts : "",
          userId:
            typeof message.user === "string"
              ? message.user
              : typeof message.bot_id === "string"
                ? message.bot_id
                : undefined,
          text: typeof message.text === "string" ? message.text : ""
        }))
        .filter((message) => message.ts.length > 0 && message.text.length > 0);

      out.push(...pageMessages);
      cursor = response.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return out;
  }

  public async postThreadReply(input: {
    channelId: string;
    threadTs: string;
    text: string;
  }): Promise<void> {
    await this.callSlackApi<ChatPostMessageResponse>("chat.postMessage", {
      channel: input.channelId,
      thread_ts: input.threadTs,
      text: input.text,
      unfurl_links: false,
      unfurl_media: false
    });
  }
}
