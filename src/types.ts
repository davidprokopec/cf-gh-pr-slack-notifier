export interface StatusConfig {
  emoji: string;
  text: string;
}

export interface RuntimeConfig {
  slackChannel: string;
  githubToSlackMap: Record<string, string>;
  githubToSlackGroupMap: Record<string, string[]>;
}

export type EventType =
  | "pr_opened"
  | "review_requested"
  | "review_submitted"
  | "comment"
  | "pr_closed"
  | "pr_updated"
  | "other";

type Status =
  | "opened"
  | "reopened"
  | "ready_for_review"
  | "draft"
  | "approved"
  | "changes_requested"
  | "merged"
  | "closed"
  | "review_requested"
  | "commented";

export interface NormalizedPayloadSkipped {
  skip: true;
  reason: string;
}

export interface NormalizedPayloadSuccess {
  skip: false;
  prKey: string;
  prNumber: number;
  prTitle: string;
  prBody: string;
  prUrl: string;
  prAuthor: string;
  repoFullName: string;
  status: Status | null;
  statusConfig: StatusConfig;
  eventType: EventType;
  action?: string;
  event: string;
  mainMessageText: string;
  threadReply: string | null;
  requestedReviewers: string[];
  slackChannel: string;
  sender?: string;
  reviewState?: string;
  githubUsername: string;
  githubAvatarUrl: string;
  isDraft: boolean;
}

export type NormalizedPayload =
  | NormalizedPayloadSkipped
  | NormalizedPayloadSuccess;

export interface PrMessageRecord {
  prKey: string;
  slackTs: string;
  slackChannel: string;
  status: string | null;
  isDraft: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PostMessageParams {
  channel: string;
  text: string;
  thread_ts?: string;
  username?: string;
  icon_url?: string;
}

export interface UpdateMessageParams {
  channel: string;
  ts: string;
  text: string;
}

export interface SlackMessageResult {
  ts: string;
  channel: string;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    display_name?: string;
    real_name?: string;
  };
}
