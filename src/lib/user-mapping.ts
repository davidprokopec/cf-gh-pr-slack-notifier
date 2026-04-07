import type { SlackUser } from "../types";

export function buildSlackUserMap(slackUsers: SlackUser[]): Map<string, string> {
  const slackIdMap = new Map<string, string>();

  for (const user of slackUsers) {
    if (!user.id || !user.name) {
      continue;
    }

    slackIdMap.set(user.name, user.id);

    const displayName = user.profile?.display_name;
    if (displayName && displayName.length > 0) {
      slackIdMap.set(displayName, user.id);
    }
  }

  return slackIdMap;
}

export function mapGithubToSlack(
  githubUsername: string | undefined,
  slackUserMap: Map<string, string>,
  githubToSlackMap: Record<string, string>,
): string {
  if (!githubUsername) {
    return "@unknown";
  }

  const slackUsername = githubToSlackMap[githubUsername];
  if (slackUsername) {
    const slackUserId = slackUserMap.get(slackUsername);
    if (slackUserId) {
      return `<@${slackUserId}>`;
    }

    return `<@${slackUsername}>`;
  }

  return `@${githubUsername}`;
}

export function resolveReviewers(
  reviewers: string[],
  githubToSlackMap: Record<string, string>,
  slackUserMap: Map<string, string>,
): string {
  if (reviewers.length === 0) {
    return "";
  }

  const mappedReviewers = reviewers.map((reviewer) =>
    mapGithubToSlack(reviewer, slackUserMap, githubToSlackMap),
  );

  return `\nReviewers: [${mappedReviewers.join(", ")}]`;
}
