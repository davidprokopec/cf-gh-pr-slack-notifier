import { describe, expect, test } from "bun:test";
import {
  truncate,
  buildMainMessageText,
  buildThreadReply,
} from "../src/lib/message-builder";

const githubToSlackMap: Record<string, string> = {
  "alice-dev": "Alice Developer",
  "bob-dev": "Bob Builder",
  "charlie-dev": "Charlie Coder",
};

const slackUserMap = new Map<string, string>([
  ["Alice Developer", "U_ALICE"],
  ["Bob Builder", "U_BOB"],
  ["Charlie Coder", "U_CHARLIE"],
]);

describe("truncate", () => {
  test("returns text unchanged when under max length", () => {
    expect(truncate("short text", 100)).toBe("short text");
  });

  test("returns text unchanged when exactly at max length", () => {
    expect(truncate("12345", 5)).toBe("12345");
  });

  test("truncates and appends ellipsis when over max length", () => {
    expect(truncate("this is a long string", 10)).toBe("this is a ...");
  });

  test("truncates at 0 max length", () => {
    expect(truncate("any text", 0)).toBe("...");
  });
});

describe("buildMainMessageText", () => {
  test("builds basic opened PR message", () => {
    const result = buildMainMessageText({
      isDraft: false,
      status: "opened",
      statusEmoji: ":large_yellow_circle:",
      statusText: "OPENED",
      review: undefined,
      repositoryUrl: "https://github.com/org/repo",
      repositoryName: "repo",
      pullRequestUrl: "https://github.com/org/repo/pull/1",
      pullRequestTitle: "feat: add feature",
      pullRequestAuthor: "alice-dev",
      requestedReviewers: [],
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toBe(
      ":large_yellow_circle: OPENED | <https://github.com/org/repo|repo> - <https://github.com/org/repo/pull/1|feat: add feature> | <@U_ALICE>",
    );
  });

  test("builds draft PR message with DRAFT header", () => {
    const result = buildMainMessageText({
      isDraft: true,
      status: "opened",
      statusEmoji: ":large_yellow_circle:",
      statusText: "OPENED",
      review: undefined,
      repositoryUrl: "https://github.com/org/repo",
      repositoryName: "repo",
      pullRequestUrl: "https://github.com/org/repo/pull/1",
      pullRequestTitle: "wip: draft feature",
      pullRequestAuthor: "alice-dev",
      requestedReviewers: [],
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toContain(":white_circle: DRAFT |");
    expect(result).toContain("<@U_ALICE>");
  });

  test("includes reviewer mentions on draft PR", () => {
    const result = buildMainMessageText({
      isDraft: true,
      status: null,
      statusEmoji: "",
      statusText: "",
      review: undefined,
      repositoryUrl: "https://github.com/org/repo",
      repositoryName: "repo",
      pullRequestUrl: "https://github.com/org/repo/pull/1",
      pullRequestTitle: "feat: add feature",
      pullRequestAuthor: "alice-dev",
      requestedReviewers: ["bob-dev", "charlie-dev"],
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toContain(":eyes: Review requested <@U_BOB>, <@U_CHARLIE>");
  });

  test("includes approved review by line on non-draft PR", () => {
    const result = buildMainMessageText({
      isDraft: false,
      status: "approved",
      statusEmoji: ":white_check_mark:",
      statusText: "APPROVED",
      review: {
        state: "approved",
        body: "LGTM",
        html_url: "https://github.com/org/repo/pull/1#review-1",
        user: { login: "bob-dev", avatar_url: "" },
      },
      repositoryUrl: "https://github.com/org/repo",
      repositoryName: "repo",
      pullRequestUrl: "https://github.com/org/repo/pull/1",
      pullRequestTitle: "feat: add feature",
      pullRequestAuthor: "alice-dev",
      requestedReviewers: [],
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toContain("APPROVED by <@U_BOB>");
  });

  test("draft PR with approved review shows DRAFT header and APPROVED on second line", () => {
    const result = buildMainMessageText({
      isDraft: true,
      status: "approved",
      statusEmoji: ":white_check_mark:",
      statusText: "APPROVED",
      review: {
        state: "approved",
        body: "LGTM",
        html_url: "https://github.com/org/repo/pull/1#review-1",
        user: { login: "bob-dev", avatar_url: "" },
      },
      repositoryUrl: "https://github.com/org/repo",
      repositoryName: "repo",
      pullRequestUrl: "https://github.com/org/repo/pull/1",
      pullRequestTitle: "feat: add feature",
      pullRequestAuthor: "alice-dev",
      requestedReviewers: [],
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toMatch(/^:white_circle: DRAFT \|/);
    expect(result).toContain("\n:white_check_mark: APPROVED by <@U_BOB>");
  });
});

describe("buildThreadReply", () => {
  test("returns PR description for pr_opened event", () => {
    const result = buildThreadReply({
      eventType: "pr_opened",
      event: "pull_request",
      pullRequestBody: "This PR adds the new feature",
      review: undefined,
      comment: undefined,
      status: "opened",
      statusEmoji: ":large_yellow_circle:",
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toBe("*Description:*\nThis PR adds the new feature");
  });

  test("returns null for pr_opened with empty body", () => {
    const result = buildThreadReply({
      eventType: "pr_opened",
      event: "pull_request",
      pullRequestBody: "   ",
      review: undefined,
      comment: undefined,
      status: "opened",
      statusEmoji: ":large_yellow_circle:",
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toBeNull();
  });

  test("returns review comment for approved review_submitted", () => {
    const result = buildThreadReply({
      eventType: "review_submitted",
      event: "pull_request_review",
      pullRequestBody: "",
      review: {
        state: "approved",
        body: "Looks great!",
        html_url: "https://github.com/org/repo/pull/1#review-1",
        user: { login: "bob-dev", avatar_url: "" },
      },
      comment: undefined,
      status: "approved",
      statusEmoji: ":white_check_mark:",
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toContain(":white_check_mark: *Approved with comment* by <@U_BOB>:");
    expect(result).toContain("Looks great!");
    expect(result).toContain("View review");
  });

  test("returns null for review_submitted with empty body", () => {
    const result = buildThreadReply({
      eventType: "review_submitted",
      event: "pull_request_review",
      pullRequestBody: "",
      review: {
        state: "approved",
        body: "  ",
        html_url: "https://github.com/org/repo/pull/1#review-1",
        user: { login: "bob-dev", avatar_url: "" },
      },
      comment: undefined,
      status: "approved",
      statusEmoji: ":white_check_mark:",
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toBeNull();
  });

  test("returns changes_requested review thread reply", () => {
    const result = buildThreadReply({
      eventType: "review_submitted",
      event: "pull_request_review",
      pullRequestBody: "",
      review: {
        state: "changes_requested",
        body: "Please fix the tests",
        html_url: "https://github.com/org/repo/pull/1#review-2",
        user: { login: "bob-dev", avatar_url: "" },
      },
      comment: undefined,
      status: "changes_requested",
      statusEmoji: ":red_circle:",
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toContain(":red_circle: *Changes requested with comment* by <@U_BOB>:");
    expect(result).toContain("Please fix the tests");
  });

  test("returns comment thread reply for comment event", () => {
    const result = buildThreadReply({
      eventType: "comment",
      event: "issue_comment",
      pullRequestBody: "",
      review: undefined,
      comment: {
        body: "Can you add a test?",
        html_url: "https://github.com/org/repo/pull/1#comment-1",
        user: { login: "charlie-dev", avatar_url: "" },
      },
      status: "commented",
      statusEmoji: ":speech_balloon:",
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toBe(
      ":speech_balloon: *<https://github.com/org/repo/pull/1#comment-1|Comment>* by charlie-dev:\nCan you add a test?",
    );
  });

  test("returns null when no matching condition", () => {
    const result = buildThreadReply({
      eventType: "pr_closed",
      event: "pull_request",
      pullRequestBody: "",
      review: undefined,
      comment: undefined,
      status: "merged",
      statusEmoji: ":ballot_box_with_check:",
      slackUserMap,
      githubToSlackMap,
    });

    expect(result).toBeNull();
  });
});
