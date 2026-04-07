import type { StatusConfig } from "../types";

export const STATUS_CONFIG = {
  opened: {
    emoji: ":large_yellow_circle:",
    text: "OPENED",
  },
  reopened: {
    emoji: ":large_yellow_circle:",
    text: "REOPENED",
  },
  ready_for_review: {
    emoji: ":large_yellow_circle:",
    text: "READY FOR REVIEW",
  },
  draft: {
    emoji: ":white_circle:",
    text: "DRAFT",
  },
  approved: {
    emoji: ":white_check_mark:",
    text: "APPROVED",
  },
  changes_requested: {
    emoji: ":red_circle:",
    text: "CHANGES REQUESTED",
  },
  merged: {
    emoji: ":ballot_box_with_check:",
    text: "MERGED",
  },
  closed: {
    emoji: ":black_circle:",
    text: "CLOSED",
  },
  review_requested: {
    emoji: ":eyes:",
    text: "REVIEW REQUESTED",
  },
  commented: {
    emoji: ":speech_balloon:",
    text: "COMMENTED",
  },
} as const satisfies Record<string, StatusConfig>;
