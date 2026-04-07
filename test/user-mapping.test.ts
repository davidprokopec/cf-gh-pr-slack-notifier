import { describe, expect, test } from "bun:test";
import {
  buildSlackUserMap,
  mapGithubToSlack,
  resolveReviewers,
} from "../src/lib/user-mapping";
import type { SlackUser } from "../src/types";

describe("buildSlackUserMap", () => {
  test("creates map entries for username and display_name", () => {
    const slackUsers: SlackUser[] = [
      {
        id: "U123",
        name: "alice_dev",
        profile: {
          display_name: "Alice Developer",
        },
      },
      {
        id: "U456",
        name: "bob-dev",
        profile: {
          display_name: "Bob Builder",
        },
      },
    ];

    const slackUserMap = buildSlackUserMap(slackUsers);

    expect(slackUserMap.get("alice_dev")).toBe("U123");
    expect(slackUserMap.get("Alice Developer")).toBe("U123");
    expect(slackUserMap.get("bob-dev")).toBe("U456");
    expect(slackUserMap.get("Bob Builder")).toBe("U456");
  });
});

describe("mapGithubToSlack", () => {
  test("returns Slack mention when github user is mapped", () => {
    const githubToSlackMap: Record<string, string> = {
      "alice-dev": "Alice Developer",
    };
    const slackUserMap = new Map<string, string>([["Alice Developer", "U123"]]);

    expect(mapGithubToSlack("alice-dev", slackUserMap, githubToSlackMap)).toBe("<@U123>");
  });

  test("returns github handle fallback for unknown user", () => {
    const githubToSlackMap: Record<string, string> = {
      "alice-dev": "Alice Developer",
    };
    const slackUserMap = new Map<string, string>([["Alice Developer", "U123"]]);

    expect(mapGithubToSlack("unknown-user", slackUserMap, githubToSlackMap)).toBe("@unknown-user");
  });

  test("returns Slack username mention when ID not found", () => {
    const githubToSlackMap: Record<string, string> = {
      "alice-dev": "Alice Developer",
    };
    const slackUserMap = new Map<string, string>();

    expect(mapGithubToSlack("alice-dev", slackUserMap, githubToSlackMap)).toBe("<@Alice Developer>");
  });

  test("middle fallback: returns <@slackUsername> when mapped but not in slackIdMap", () => {
    const githubToSlackMap: Record<string, string> = {
      "dave-dev": "Dave Designer",
    };
    const slackUserMap = new Map<string, string>([
      ["Alice Developer", "U123"],
    ]);

    // dave-dev IS in githubToSlackMap -> "Dave Designer"
    // but "Dave Designer" is NOT in slackUserMap
    // so it should return <@Dave Designer>, NOT @dave-dev
    expect(mapGithubToSlack("dave-dev", slackUserMap, githubToSlackMap)).toBe("<@Dave Designer>");
  });
});

describe("resolveReviewers", () => {
  test("formats mapped reviewers list", () => {
    const githubToSlackMap: Record<string, string> = {
      "alice-dev": "Alice Developer",
      "bob-dev": "Bob Builder",
    };
    const slackUserMap = new Map<string, string>([
      ["Alice Developer", "U123"],
      ["Bob Builder", "U456"],
    ]);

    expect(
      resolveReviewers(["alice-dev", "bob-dev"], githubToSlackMap, slackUserMap),
    ).toBe("\nReviewers: [<@U123>, <@U456>]");
  });
});
