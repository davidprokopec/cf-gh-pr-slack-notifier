import { STATUS_CONFIG } from "../config";
import type { EventType, NormalizedPayload, RuntimeConfig } from "../types";
import { buildMainMessageText, buildThreadReply } from "./message-builder";

type StatusKey = keyof typeof STATUS_CONFIG;

interface GitHubUser {
  login?: string;
  avatar_url?: string;
}

interface GitHubReviewer {
  login: string;
}

interface GitHubPullRequestLike {
  number?: number;
  title?: string;
  body?: string;
  html_url?: string;
  draft?: boolean;
  merged?: boolean;
  user?: GitHubUser;
  requested_reviewers?: GitHubReviewer[];
}

interface GitHubIssue extends GitHubPullRequestLike {
  pull_request?: {
    html_url?: string;
  };
}

export interface GitHubReview {
  state?: string;
  body?: string;
  html_url?: string;
  user?: GitHubUser;
}

export interface GitHubComment {
  body?: string;
  html_url?: string;
  user?: GitHubUser;
}

interface GitHubRepository {
  full_name?: string;
  html_url?: string;
}

export interface GitHubWebhookBody {
  action?: string;
  pull_request?: GitHubPullRequestLike;
  issue?: GitHubIssue;
  review?: GitHubReview;
  comment?: GitHubComment;
  sender?: GitHubUser;
  repository?: GitHubRepository;
}

function getReviewStatus(review: GitHubReview | undefined): StatusKey | null {
  switch (review?.state?.toLowerCase()) {
    case "approved": return "approved";
    case "changes_requested": return "changes_requested";
    case "commented": return "commented";
    default: return null;
  }
}

function getStatusFromAction(
  event: string,
  action: string | undefined,
  pullRequest: GitHubPullRequestLike | undefined,
  review: GitHubReview | undefined,
): StatusKey | null {
  if (event === "pull_request_review") {
    return getReviewStatus(review);
  }

  switch (action) {
    case "closed":
      return pullRequest?.merged ? "merged" : "closed";
    case "opened":
    case "reopened":
      return pullRequest?.draft ? "draft" : (action as StatusKey);
    case "converted_to_draft":
      return "draft";
    case "ready_for_review":
      return "ready_for_review";
    case "review_request_removed":
      return pullRequest?.draft ? "draft" : "opened";
    case "review_requested":
      return null;
    default:
      if (!action || !(action in STATUS_CONFIG)) return null;
      return action as StatusKey;
  }
}

function getEventType(
  event: string,
  action: string | undefined,
  review: GitHubReview | undefined,
): EventType {
  switch (event) {
    case "pull_request_review":
      return review?.state?.toLowerCase() === "commented" ? "comment" : "review_submitted";
    case "issue_comment":
    case "pull_request_review_comment":
      return "comment";
  }

  switch (action) {
    case "opened":
    case "reopened":
    case "ready_for_review":
      return "pr_opened";
    case "review_requested":
    case "review_request_removed":
      return "review_requested";
    case "closed":
    case "converted_to_draft":
      return "pr_closed";
    case "synchronize":
      return "pr_updated";
    default:
      return "other";
  }
}

function resolveActorIdentity(params: {
  status: StatusKey | null;
  eventType: EventType;
  pullRequestAuthor: string;
  pullRequestAuthorAvatarUrl: string;
  sender: GitHubUser | undefined;
  senderAvatarUrl: string;
  comment: GitHubComment | undefined;
  commentAuthorAvatarUrl: string;
  review: GitHubReview | undefined;
  reviewAuthorAvatarUrl: string;
}): { githubUsername: string; githubAvatarUrl: string } {
  const fallback = { githubUsername: params.pullRequestAuthor, githubAvatarUrl: params.pullRequestAuthorAvatarUrl };

  // Review actions attribute to the sender (reviewer), not the PR author
  if (params.status === "approved" || params.status === "changes_requested") {
    return {
      githubUsername: params.sender?.login ?? fallback.githubUsername,
      githubAvatarUrl: params.senderAvatarUrl || fallback.githubAvatarUrl,
    };
  }

  switch (params.eventType) {
    case "comment":
      return {
        githubUsername: params.comment?.user?.login ?? fallback.githubUsername,
        githubAvatarUrl: params.commentAuthorAvatarUrl || fallback.githubAvatarUrl,
      };
    case "review_submitted":
      return {
        githubUsername: params.review?.user?.login ?? fallback.githubUsername,
        githubAvatarUrl: params.reviewAuthorAvatarUrl || fallback.githubAvatarUrl,
      };
    default:
      return fallback;
  }
}

export function normalizePayload(
  event: string,
  body: GitHubWebhookBody,
  slackUserMap: Map<string, string>,
  config: RuntimeConfig,
): NormalizedPayload {
  const action = body.action;
  const pullRequest = body.pull_request;
  const review = body.review;
  const comment = body.comment;
  const sender = body.sender;
  const repository = body.repository;

  if (!pullRequest && event !== "issue_comment") {
    return {
      skip: true,
      reason: "Not a PR event",
    };
  }

  if (event === "issue_comment" && !body.issue?.pull_request) {
    return {
      skip: true,
      reason: "Comment not on a PR",
    };
  }

  if (
    event === "pull_request_review" &&
    review?.state?.toLowerCase() === "commented" &&
    !review?.body?.trim()
  ) {
    return {
      skip: true,
      reason: "Empty review comment (handled by review_comment event)",
    };
  }

  const pullRequestData = pullRequest ?? body.issue;
  const prAuthorLogin = pullRequestData?.user?.login ?? "";

  if (prAuthorLogin === "dependabot[bot]" || prAuthorLogin.startsWith("dependabot")) {
    return {
      skip: true,
      reason: "PR from dependabot",
    };
  }
  const pullRequestNumber = pullRequestData?.number ?? 0;
  const pullRequestTitle = pullRequestData?.title ?? "";
  const pullRequestBody = pullRequestData?.body ?? "";
  const pullRequestUrl = pullRequestData?.html_url ?? "";
  const pullRequestAuthor = pullRequestData?.user?.login ?? "";
  const repositoryFullName = repository?.full_name ?? "";
  const slashIndex = repositoryFullName.indexOf("/");
  const repositoryNameWithoutPrefix =
    slashIndex !== -1 ? repositoryFullName.slice(slashIndex + 1) : repositoryFullName;

  const prKey = `pr:${repositoryFullName}:${pullRequestNumber}`;
  const isDraft = pullRequest?.draft ?? false;
  let status = getStatusFromAction(event, action, pullRequest, review);

  if (
    (event === "pull_request_review" && review?.state?.toLowerCase() === "commented") ||
    action === "review_requested"
  ) {
    status = null;
  }

  const statusConfig = isDraft && !status
    ? STATUS_CONFIG.draft
    : status
      ? STATUS_CONFIG[status] ?? STATUS_CONFIG.opened
      : STATUS_CONFIG.opened;
  const requestedReviewers =
    pullRequest?.requested_reviewers?.map((reviewer) => reviewer.login) ?? [];
  const eventType = getEventType(event, action, review);

  const pullRequestAuthorAvatarUrl = pullRequestData?.user?.avatar_url ?? "";
  const senderAvatarUrl = sender?.avatar_url ?? "";
  const commentAuthorAvatarUrl = comment?.user?.avatar_url ?? "";
  const reviewAuthorAvatarUrl = review?.user?.avatar_url ?? "";

  const { githubUsername, githubAvatarUrl } = resolveActorIdentity({
    status,
    eventType,
    pullRequestAuthor,
    pullRequestAuthorAvatarUrl,
    sender,
    senderAvatarUrl,
    comment,
    commentAuthorAvatarUrl,
    review,
    reviewAuthorAvatarUrl,
  });

  const mainMessageText = buildMainMessageText({
    isDraft,
    status,
    statusEmoji: statusConfig.emoji,
    statusText: statusConfig.text,
    review,
    repositoryUrl: repository?.html_url ?? "",
    repositoryName: repositoryNameWithoutPrefix,
    pullRequestUrl,
    pullRequestTitle,
    pullRequestAuthor,
    requestedReviewers,
    slackUserMap,
    githubToSlackMap: config.githubToSlackMap,
  });

  const threadReply = buildThreadReply({
    eventType,
    event,
    pullRequestBody,
    review,
    comment,
    status,
    statusEmoji: statusConfig.emoji,
    slackUserMap,
    githubToSlackMap: config.githubToSlackMap,
  });

  return {
    skip: false,
    prKey,
    prNumber: pullRequestNumber,
    prTitle: pullRequestTitle,
    prBody: pullRequestBody,
    prUrl: pullRequestUrl,
    prAuthor: pullRequestAuthor,
    repoFullName: repositoryFullName,
    isDraft,
    status,
    statusConfig,
    eventType,
    action,
    event,
    mainMessageText,
    threadReply,
    requestedReviewers,
    slackChannel: config.slackChannel,
    sender: sender?.login,
    reviewState: review?.state,
    githubUsername,
    githubAvatarUrl,
  };
}
