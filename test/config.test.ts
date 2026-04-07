import { test, expect } from "bun:test";
import { STATUS_CONFIG } from "../src/config/status";
import { GITHUB_TO_SLACK_MAP } from "../src/config/users";
import { GITHUB_TO_SLACK_GROUP_MAP } from "../src/config/groups";
import { SLACK_CHANNEL } from "../src/config/channels";
import {
  PR_DESCRIPTION_MAX_LENGTH,
  REVIEW_BODY_MAX_LENGTH,
  COMMENT_BODY_MAX_LENGTH,
} from "../src/config/messages";

test("STATUS_CONFIG has exactly 10 statuses with emoji and text", () => {
  expect(Object.keys(STATUS_CONFIG)).toHaveLength(10);
  expect(STATUS_CONFIG).toHaveProperty("opened");
  expect(STATUS_CONFIG).toHaveProperty("reopened");
  expect(STATUS_CONFIG).toHaveProperty("ready_for_review");
  expect(STATUS_CONFIG).toHaveProperty("draft");
  expect(STATUS_CONFIG).toHaveProperty("approved");
  expect(STATUS_CONFIG).toHaveProperty("changes_requested");
  expect(STATUS_CONFIG).toHaveProperty("merged");
  expect(STATUS_CONFIG).toHaveProperty("closed");
  expect(STATUS_CONFIG).toHaveProperty("review_requested");
  expect(STATUS_CONFIG).toHaveProperty("commented");

  Object.values(STATUS_CONFIG).forEach((status) => {
    expect(status).toHaveProperty("emoji");
    expect(status).toHaveProperty("text");
    expect(typeof status.emoji).toBe("string");
    expect(typeof status.text).toBe("string");
  });
});

test("STATUS_CONFIG has correct values", () => {
  expect(STATUS_CONFIG.opened.emoji).toBe(":large_yellow_circle:");
  expect(STATUS_CONFIG.opened.text).toBe("OPENED");
  expect(STATUS_CONFIG.approved.emoji).toBe(":white_check_mark:");
  expect(STATUS_CONFIG.approved.text).toBe("APPROVED");
  expect(STATUS_CONFIG.merged.emoji).toBe(":ballot_box_with_check:");
  expect(STATUS_CONFIG.merged.text).toBe("MERGED");
});

test("GITHUB_TO_SLACK_MAP is empty by default (configured at runtime)", () => {
  expect(Object.keys(GITHUB_TO_SLACK_MAP)).toHaveLength(0);
});

test("GITHUB_TO_SLACK_GROUP_MAP is typed as Record<string, string[]>", () => {
  expect(typeof GITHUB_TO_SLACK_GROUP_MAP).toBe("object");
  Object.values(GITHUB_TO_SLACK_GROUP_MAP).forEach((value) => {
    expect(Array.isArray(value)).toBe(true);
  });
});

test("SLACK_CHANNEL equals #pr-notifications", () => {
  expect(SLACK_CHANNEL).toBe("#pr-notifications");
});

test("Message length configs have correct values", () => {
  expect(PR_DESCRIPTION_MAX_LENGTH).toBe(3000);
  expect(REVIEW_BODY_MAX_LENGTH).toBe(2000);
  expect(COMMENT_BODY_MAX_LENGTH).toBe(2000);
});
