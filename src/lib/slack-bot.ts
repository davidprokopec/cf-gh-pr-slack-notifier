import type { PostMessageParams, SlackMessageResult, UpdateMessageParams } from "../types";
import { postMessage, updateMessage } from "./slack";

export class SlackBot {
  constructor(private readonly token: string) {}

  post(params: PostMessageParams): Promise<SlackMessageResult> {
    return postMessage(this.token, params);
  }

  update(params: UpdateMessageParams): Promise<SlackMessageResult> {
    return updateMessage(this.token, params);
  }

  async postThreadReply(params: {
    threadReply: string | null;
    channel: string;
    threadTs: string;
    username: string;
    iconUrl: string;
  }): Promise<void> {
    if (!params.threadReply) {
      return;
    }

    await this.post({
      channel: params.channel,
      thread_ts: params.threadTs,
      text: params.threadReply,
      username: params.username,
      icon_url: params.iconUrl,
    });
  }
}
