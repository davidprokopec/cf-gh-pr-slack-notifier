import { describe, expect, test } from "bun:test";
import {
  buildPostMessageBody,
  buildUpdateMessageBody,
  parseSlackResponse,
} from "../src/lib/slack";

describe("buildPostMessageBody", () => {
  test("returns complete request body with defaults and Slack flags", () => {
    expect(
      buildPostMessageBody({
        channel: "C123",
        text: "Hello world",
        thread_ts: "1700000000.000001",
      }),
    ).toStrictEqual({
      channel: "C123",
      text: "Hello world",
      thread_ts: "1700000000.000001",
      username: "GitHub PR",
      icon_url:
        "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
      unfurl_links: false,
      unfurl_media: false,
      mrkdwn: true,
    });
  });

  test("keeps provided username and icon_url", () => {
    expect(
      buildPostMessageBody({
        channel: "C123",
        text: "Hello world",
        username: "Custom Bot",
        icon_url: "https://example.com/icon.png",
      }),
    ).toStrictEqual({
      channel: "C123",
      text: "Hello world",
      thread_ts: undefined,
      username: "Custom Bot",
      icon_url: "https://example.com/icon.png",
      unfurl_links: false,
      unfurl_media: false,
      mrkdwn: true,
    });
  });
});

describe("buildUpdateMessageBody", () => {
  test("returns update body with channel, ts, and text", () => {
    expect(
      buildUpdateMessageBody({
        channel: "C123",
        ts: "1700000000.000001",
        text: "Updated message",
      }),
    ).toStrictEqual({
      channel: "C123",
      ts: "1700000000.000001",
      text: "Updated message",
    });
  });
});

describe("parseSlackResponse", () => {
  test("extracts ts and channel from successful Slack response", () => {
    expect(
      parseSlackResponse({
        ok: true,
        ts: "1700000000.000001",
        channel: "C123",
      }),
    ).toStrictEqual({
      ts: "1700000000.000001",
      channel: "C123",
    });
  });

  test("throws on Slack API error response", () => {
    expect(() =>
      parseSlackResponse({
        ok: false,
        error: "channel_not_found",
      }),
    ).toThrow("Slack API error: channel_not_found");
  });
});
