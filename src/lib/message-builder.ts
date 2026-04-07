import {
  COMMENT_BODY_MAX_LENGTH,
  PR_DESCRIPTION_MAX_LENGTH,
  REVIEW_BODY_MAX_LENGTH,
  STATUS_CONFIG,
} from "../config";
import type { EventType } from "../types";
import { mapGithubToSlack, resolveReviewers } from "./user-mapping";
import type { GitHubReview, GitHubComment } from "./normalize";

type StatusKey = keyof typeof STATUS_CONFIG;

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.substring(0, maxLength)}...`;
}

export function buildMainMessageText(params: {
  isDraft: boolean;
  status: StatusKey | null;
  statusEmoji: string;
  statusText: string;
  review: GitHubReview | undefined;
  repositoryUrl: string;
  repositoryName: string;
  pullRequestUrl: string;
  pullRequestTitle: string;
  pullRequestAuthor: string | undefined;
  requestedReviewers: string[];
  slackUserMap: Map<string, string>;
  githubToSlackMap: Record<string, string>;
}): string {
  const {
    isDraft,
    status,
    statusEmoji,
    statusText,
    review,
    repositoryUrl,
    repositoryName,
    pullRequestUrl,
    pullRequestTitle,
    pullRequestAuthor,
    requestedReviewers,
    slackUserMap,
    githubToSlackMap,
  } = params;

  const mappedAuthor = mapGithubToSlack(pullRequestAuthor, slackUserMap, githubToSlackMap);

  if (isDraft) {
    let mainMessageText = `${STATUS_CONFIG.draft.emoji} ${STATUS_CONFIG.draft.text} | <${repositoryUrl}|${repositoryName}> - <${pullRequestUrl}|${pullRequestTitle}> | ${mappedAuthor}`;

    if ((status === "approved" || status === "changes_requested") && review?.user) {
      mainMessageText += `\n${statusEmoji} ${statusText} by ${mapGithubToSlack(review.user.login, slackUserMap, githubToSlackMap)}`;
    }

    if (requestedReviewers.length > 0) {
      const mappedReviewers = requestedReviewers.map((reviewer) =>
        mapGithubToSlack(reviewer, slackUserMap, githubToSlackMap),
      );
      mainMessageText += `\n:eyes: Review requested ${mappedReviewers.join(", ")}`;
    }

    return mainMessageText;
  }

  let firstLine = `${statusEmoji} ${statusText}`;

  if ((status === "approved" || status === "changes_requested") && review?.user) {
    firstLine += ` by ${mapGithubToSlack(review.user.login, slackUserMap, githubToSlackMap)}`;
  }

  let mainMessageText = `${firstLine} | <${repositoryUrl}|${repositoryName}> - <${pullRequestUrl}|${pullRequestTitle}> | ${mappedAuthor}`;

  if (requestedReviewers.length > 0) {
    const mappedReviewers = requestedReviewers.map((reviewer) =>
      mapGithubToSlack(reviewer, slackUserMap, githubToSlackMap),
    );

    mainMessageText += `\n:eyes: Review requested ${mappedReviewers.join(", ")}`;
  }

  return mainMessageText;
}

function buildPrDescriptionReply(body: string): string | null {
  if (!body.trim()) return null;
  return `*Description:*\n${truncate(body, PR_DESCRIPTION_MAX_LENGTH)}`;
}

function buildReviewReply(
  review: GitHubReview | undefined,
  statusEmoji: string,
  slackUserMap: Map<string, string>,
  githubToSlackMap: Record<string, string>,
): string | null {
  if (!review) return null;
  const reviewBody = review.body ?? "";
  if (!reviewBody.trim()) return null;

  const reviewer = mapGithubToSlack(review.user?.login, slackUserMap, githubToSlackMap);
  const body = truncate(reviewBody, REVIEW_BODY_MAX_LENGTH);
  const link = `<${review.html_url ?? ""}|View review>`;

  switch (review.state?.toLowerCase()) {
    case "approved":
      return `${statusEmoji} *Approved with comment* by ${reviewer}:\n${body}\n${link}`;
    case "changes_requested":
      return `${statusEmoji} *Changes requested with comment* by ${reviewer}:\n${body}\n${link}`;
    default:
      return `${statusEmoji} *${review.state ?? ""}* by ${reviewer}:\n${body}\n${link}`;
  }
}

function buildCommentReply(
  event: string,
  comment: GitHubComment | undefined,
  review: GitHubReview | undefined,
): string | null {
  const source = comment ?? (event === "pull_request_review" ? review : undefined);
  if (!source) return null;

  const body = source.body ?? "";
  const url = source.html_url ?? "";
  const author = source.user?.login ?? "unknown";

  return `:speech_balloon: *<${url}|Comment>* by ${author}:\n${truncate(body, COMMENT_BODY_MAX_LENGTH)}`;
}

export function buildThreadReply(params: {
  eventType: EventType;
  event: string;
  pullRequestBody: string;
  review: GitHubReview | undefined;
  comment: GitHubComment | undefined;
  status: StatusKey | null;
  statusEmoji: string;
  slackUserMap: Map<string, string>;
  githubToSlackMap: Record<string, string>;
}): string | null {
  const {
    eventType,
    event,
    pullRequestBody,
    review,
    comment,
    status,
    statusEmoji,
    slackUserMap,
    githubToSlackMap,
  } = params;

  switch (eventType) {
    case "pr_opened":
      return buildPrDescriptionReply(pullRequestBody);

    case "review_submitted":
      return buildReviewReply(review, statusEmoji, slackUserMap, githubToSlackMap);

    case "comment":
      return buildCommentReply(event, comment, review);

    default:
      if (status === "review_requested") {
        const reviewerLogins = review?.user ? [review.user.login ?? ""] : [];
        return resolveReviewers(reviewerLogins, githubToSlackMap, slackUserMap);
      }
      return null;
  }
}
