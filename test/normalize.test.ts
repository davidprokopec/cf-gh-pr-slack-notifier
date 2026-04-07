import { describe, expect, test } from "bun:test";
import { normalizePayload, type GitHubWebhookBody } from "../src/lib/normalize";
import type {
  NormalizedPayload,
  NormalizedPayloadSkipped,
  NormalizedPayloadSuccess,
  RuntimeConfig,
} from "../src/types";

const testConfig: RuntimeConfig = {
  slackChannel: "#pr-notifications",
  githubToSlackMap: {
    "alice-dev": "Alice Developer",
    "bob-dev": "Bob Builder",
    "charlie-dev": "Charlie Coder",
  },
  githubToSlackGroupMap: {},
};

const slackUserMap = new Map<string, string>([
  ["Alice Developer", "U_DAVID"],
  ["Bob Builder", "U_TOMAS"],
  ["Charlie Coder", "U_ALES"],
]);

function createPullRequestBody(
  overrides: Partial<GitHubWebhookBody> = {},
): GitHubWebhookBody {
  return {
    action: "opened",
    pull_request: {
      number: 42,
      title: "feat: improve webhook pipeline",
      body: "This is the PR description",
      html_url: "https://github.com/smartsupp/github-slack-notifier/pull/42",
      draft: false,
      merged: false,
      user: {
        login: "alice-dev",
        avatar_url: "https://avatars.example.com/pr-author.png",
      },
      requested_reviewers: [],
    },
    repository: {
      full_name: "smartsupp/github-slack-notifier",
      html_url: "https://github.com/smartsupp/github-slack-notifier",
    },
    sender: {
      login: "alice-dev",
      avatar_url: "https://avatars.example.com/sender.png",
    },
    ...overrides,
  };
}

function expectSuccess(
  payload: NormalizedPayload,
): NormalizedPayloadSuccess {
  expect(payload.skip).toBe(false);
  if (payload.skip) {
    throw new Error("Expected non-skipped payload");
  }

  return payload;
}

function expectSkipped(
  payload: NormalizedPayload,
): NormalizedPayloadSkipped {
  expect(payload.skip).toBe(true);
  if (!payload.skip) {
    throw new Error("Expected skipped payload");
  }

  return payload;
}

describe("normalizePayload", () => {
  test("normalizes PR opened event", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request",
      createPullRequestBody(),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.eventType).toBe("pr_opened");
    expect(payload.status).toBe("opened");
    expect(payload.mainMessageText).toContain(
      ":large_yellow_circle: OPENED | <https://github.com/smartsupp/github-slack-notifier|github-slack-notifier> - <https://github.com/smartsupp/github-slack-notifier/pull/42|feat: improve webhook pipeline> | <@U_DAVID>",
    );
    expect(payload.threadReply).toBe("*Description:*\nThis is the PR description");
  });

  test("marks opened draft PR as draft status", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request",
      createPullRequestBody({
        pull_request: {
          ...createPullRequestBody().pull_request,
          draft: true,
        },
      }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.status).toBe("draft");
  });

  test("routes review requested event with null status", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request",
      createPullRequestBody({
        action: "review_requested",
        pull_request: {
          ...createPullRequestBody().pull_request,
          requested_reviewers: [{ login: "bob-dev" }],
        },
      }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.eventType).toBe("review_requested");
    expect(payload.status).toBeNull();
    expect(payload.mainMessageText).toContain(":eyes: Review requested <@U_TOMAS>");
  });

  test("draft PR + review_requested shows DRAFT header with review requested on second line", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request",
      createPullRequestBody({
        action: "review_requested",
        pull_request: {
          ...createPullRequestBody().pull_request,
          draft: true,
          requested_reviewers: [{ login: "bob-dev" }],
        },
      }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.isDraft).toBe(true);
    expect(payload.status).toBeNull();
    expect(payload.mainMessageText).toBe(
      ":white_circle: DRAFT | <https://github.com/smartsupp/github-slack-notifier|github-slack-notifier> - <https://github.com/smartsupp/github-slack-notifier/pull/42|feat: improve webhook pipeline> | <@U_DAVID>\n:eyes: Review requested <@U_TOMAS>",
    );
  });

  test("normalizes approved review submission", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request_review",
      createPullRequestBody({
        action: "submitted",
        review: {
          state: "approved",
          body: "Looks good to me",
          html_url: "https://github.com/smartsupp/github-slack-notifier/pull/42#pullrequestreview-1",
          user: {
            login: "bob-dev",
            avatar_url: "https://avatars.example.com/reviewer.png",
          },
        },
        sender: {
          login: "bob-dev",
          avatar_url: "https://avatars.example.com/reviewer-sender.png",
        },
      }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.eventType).toBe("review_submitted");
    expect(payload.status).toBe("approved");
    expect(payload.mainMessageText).toContain("APPROVED by <@U_TOMAS>");
  });

  test("draft PR + approved shows DRAFT header with APPROVED on second line", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request_review",
      createPullRequestBody({
        action: "submitted",
        pull_request: {
          ...createPullRequestBody().pull_request,
          draft: true,
        },
        review: {
          state: "approved",
          body: "LGTM",
          html_url: "https://github.com/smartsupp/github-slack-notifier/pull/42#pullrequestreview-1",
          user: {
            login: "bob-dev",
            avatar_url: "https://avatars.example.com/reviewer.png",
          },
        },
        sender: {
          login: "bob-dev",
          avatar_url: "https://avatars.example.com/reviewer-sender.png",
        },
      }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.isDraft).toBe(true);
    expect(payload.status).toBe("approved");
    expect(payload.mainMessageText).toBe(
      ":white_circle: DRAFT | <https://github.com/smartsupp/github-slack-notifier|github-slack-notifier> - <https://github.com/smartsupp/github-slack-notifier/pull/42|feat: improve webhook pipeline> | <@U_DAVID>\n:white_check_mark: APPROVED by <@U_TOMAS>",
    );
  });

  test("draft PR + changes_requested shows DRAFT header with CHANGES REQUESTED on second line", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request_review",
      createPullRequestBody({
        action: "submitted",
        pull_request: {
          ...createPullRequestBody().pull_request,
          draft: true,
        },
        review: {
          state: "changes_requested",
          body: "Please fix tests",
          html_url: "https://github.com/smartsupp/github-slack-notifier/pull/42#pullrequestreview-2",
          user: {
            login: "bob-dev",
            avatar_url: "https://avatars.example.com/reviewer.png",
          },
        },
        sender: {
          login: "bob-dev",
          avatar_url: "https://avatars.example.com/reviewer-sender.png",
        },
      }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.isDraft).toBe(true);
    expect(payload.status).toBe("changes_requested");
    expect(payload.mainMessageText).toBe(
      ":white_circle: DRAFT | <https://github.com/smartsupp/github-slack-notifier|github-slack-notifier> - <https://github.com/smartsupp/github-slack-notifier/pull/42|feat: improve webhook pipeline> | <@U_DAVID>\n:red_circle: CHANGES REQUESTED by <@U_TOMAS>",
    );
  });

  test("skips empty commented review events", () => {
    const payload = expectSkipped(
      normalizePayload(
      "pull_request_review",
      createPullRequestBody({
        action: "submitted",
        review: {
          state: "commented",
          body: "   ",
          html_url: "https://github.com/smartsupp/github-slack-notifier/pull/42#pullrequestreview-2",
          user: {
            login: "bob-dev",
            avatar_url: "https://avatars.example.com/reviewer.png",
          },
        },
      }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.reason).toBe("Empty review comment (handled by review_comment event)");
  });

  test("normalizes issue comment event with thread reply", () => {
    const payload = expectSuccess(
      normalizePayload(
      "issue_comment",
      createPullRequestBody({
        action: "created",
        issue: {
          number: 42,
          title: "feat: improve webhook pipeline",
          body: "This is the PR description",
          html_url: "https://github.com/smartsupp/github-slack-notifier/pull/42",
          user: {
            login: "alice-dev",
            avatar_url: "https://avatars.example.com/pr-author.png",
          },
          pull_request: {
            html_url: "https://api.github.com/repos/smartsupp/github-slack-notifier/pulls/42",
          },
        },
        comment: {
          body: "Can you add a regression test?",
          html_url: "https://github.com/smartsupp/github-slack-notifier/pull/42#issuecomment-1",
          user: {
            login: "charlie-dev",
            avatar_url: "https://avatars.example.com/commenter.png",
          },
        },
      }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.eventType).toBe("comment");
    expect(payload.threadReply).toBe(
      ":speech_balloon: *<https://github.com/smartsupp/github-slack-notifier/pull/42#issuecomment-1|Comment>* by charlie-dev:\nCan you add a regression test?",
    );
  });

  test("normalizes merged PR close event", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request",
      createPullRequestBody({
        action: "closed",
        pull_request: {
          ...createPullRequestBody().pull_request,
          merged: true,
        },
      }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.eventType).toBe("pr_closed");
    expect(payload.status).toBe("merged");
  });

  test("normalizes non-merged PR close event", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request",
      createPullRequestBody({ action: "closed" }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.eventType).toBe("pr_closed");
    expect(payload.status).toBe("closed");
  });

  test("skips non-PR events", () => {
    const payload = expectSkipped(
      normalizePayload(
      "push",
      {
        action: "created",
        repository: {
          full_name: "smartsupp/github-slack-notifier",
          html_url: "https://github.com/smartsupp/github-slack-notifier",
        },
      },
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.reason).toBe("Not a PR event");
  });

  test("treats converted_to_draft as pr_closed with draft status", () => {
    const payload = expectSuccess(
      normalizePayload(
      "pull_request",
      createPullRequestBody({ action: "converted_to_draft" }),
      slackUserMap,
      testConfig,
      ),
    );

    expect(payload.eventType).toBe("pr_closed");
    expect(payload.status).toBe("draft");
  });

  test("converted_to_draft sets isDraft true", () => {
    const payload = expectSuccess(
      normalizePayload(
        "pull_request",
        createPullRequestBody({
          action: "converted_to_draft",
          pull_request: {
            ...createPullRequestBody().pull_request,
            draft: true,
          },
        }),
        slackUserMap,
        testConfig,
      ),
    );

    expect(payload.isDraft).toBe(true);
    expect(payload.status).toBe("draft");
    expect(payload.eventType).toBe("pr_closed");
  });

  test("ready_for_review sets isDraft false", () => {
    const payload = expectSuccess(
      normalizePayload(
        "pull_request",
        createPullRequestBody({
          action: "ready_for_review",
          pull_request: {
            ...createPullRequestBody().pull_request,
            draft: false,
          },
        }),
        slackUserMap,
        testConfig,
      ),
    );

    expect(payload.isDraft).toBe(false);
    expect(payload.status).toBe("ready_for_review");
    expect(payload.eventType).toBe("pr_opened");
  });

  test("review_request_removed on draft preserves isDraft", () => {
    const payload = expectSuccess(
      normalizePayload(
        "pull_request",
        createPullRequestBody({
          action: "review_request_removed",
          pull_request: {
            ...createPullRequestBody().pull_request,
            draft: true,
          },
        }),
        slackUserMap,
        testConfig,
      ),
    );

    expect(payload.isDraft).toBe(true);
    expect(payload.status).toBe("draft");
  });

  test("draft PR with multiple reviewers requested", () => {
    const payload = expectSuccess(
      normalizePayload(
        "pull_request",
        createPullRequestBody({
          action: "review_requested",
          pull_request: {
            ...createPullRequestBody().pull_request,
            draft: true,
            requested_reviewers: [
              { login: "bob-dev" },
              { login: "charlie-dev" },
            ],
          },
        }),
        slackUserMap,
        testConfig,
      ),
    );

    expect(payload.isDraft).toBe(true);
    expect(payload.status).toBeNull();
    expect(payload.mainMessageText).toContain(":eyes: Review requested <@U_TOMAS>, <@U_ALES>");
    expect(payload.mainMessageText).toMatch(/^:white_circle: DRAFT \|/);
  });
});
