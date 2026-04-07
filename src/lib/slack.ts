import type {
  PostMessageParams,
  SlackMessageResult,
  SlackUser,
  UpdateMessageParams,
} from "../types";

const SLACK_API_BASE_URL = "https://slack.com/api";

const DEFAULT_USERNAME = "GitHub PR";
const DEFAULT_ICON_URL =
  "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function buildAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...JSON_HEADERS,
  };
}

function toErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "unknown_error";
}

function getNextCursor(json: Record<string, unknown>): string | undefined {
  const metadata = json.response_metadata;
  if (!isRecord(metadata)) {
    return undefined;
  }

  const nextCursor = metadata.next_cursor;
  if (typeof nextCursor !== "string" || nextCursor.length === 0) {
    return undefined;
  }

  return nextCursor;
}

function parseSlackUsersResponse(json: unknown): {
  members: SlackUser[];
  nextCursor?: string;
} {
  if (!isRecord(json)) {
    throw new Error("Invalid Slack API response format");
  }

  if (json.ok !== true) {
    throw new Error(`Slack API error: ${toErrorMessage(json.error)}`);
  }

  const members = json.members;
  if (!Array.isArray(members)) {
    throw new Error("Invalid Slack users.list response: members missing");
  }

  const normalizedMembers: SlackUser[] = members
    .filter(isRecord)
    .filter((member) => {
      return typeof member.id === "string" && typeof member.name === "string";
    })
    .map((member) => {
      const profile = isRecord(member.profile)
        ? {
            display_name:
              typeof member.profile.display_name === "string"
                ? member.profile.display_name
                : undefined,
            real_name:
              typeof member.profile.real_name === "string"
                ? member.profile.real_name
                : undefined,
          }
        : undefined;

      return {
        id: member.id as string,
        name: member.name as string,
        real_name:
          typeof member.real_name === "string" ? member.real_name : undefined,
        deleted:
          typeof member.deleted === "boolean" ? member.deleted : undefined,
        is_bot: typeof member.is_bot === "boolean" ? member.is_bot : undefined,
        profile,
      };
    });

  return {
    members: normalizedMembers,
    nextCursor: getNextCursor(json),
  };
}

async function fetchSlackMethod(
  token: string,
  method: string,
  body: object,
): Promise<unknown> {
  const response = await fetch(`${SLACK_API_BASE_URL}/${method}`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  return response.json();
}

async function fetchSlackUsersPage(
  token: string,
  cursor?: string,
): Promise<unknown> {
  const url = new URL(`${SLACK_API_BASE_URL}/users.list`);
  url.searchParams.set("limit", "200");
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.json();
}

export function buildPostMessageBody(params: PostMessageParams): object {
  return {
    channel: params.channel,
    text: params.text,
    thread_ts: params.thread_ts,
    username: params.username ?? DEFAULT_USERNAME,
    icon_url: params.icon_url ?? DEFAULT_ICON_URL,
    unfurl_links: false,
    unfurl_media: false,
    mrkdwn: true,
  };
}

export function buildUpdateMessageBody(params: UpdateMessageParams): object {
  return {
    channel: params.channel,
    ts: params.ts,
    text: params.text,
  };
}

export function parseSlackResponse(json: unknown): SlackMessageResult {
  if (!isRecord(json)) {
    throw new Error("Invalid Slack API response format");
  }

  if (json.ok !== true) {
    throw new Error(`Slack API error: ${toErrorMessage(json.error)}`);
  }

  if (typeof json.ts !== "string" || typeof json.channel !== "string") {
    throw new Error("Invalid Slack API response payload");
  }

  return {
    ts: json.ts,
    channel: json.channel,
  };
}

export async function postMessage(
  token: string,
  params: PostMessageParams,
): Promise<SlackMessageResult> {
  const body = buildPostMessageBody(params);
  const json = await fetchSlackMethod(token, "chat.postMessage", body);

  return parseSlackResponse(json);
}

export async function updateMessage(
  token: string,
  params: UpdateMessageParams,
): Promise<SlackMessageResult> {
  const body = buildUpdateMessageBody(params);
  const json = await fetchSlackMethod(token, "chat.update", body);

  return parseSlackResponse(json);
}

export async function listUsers(token: string): Promise<SlackUser[]> {
  let cursor: string | undefined;
  const users: SlackUser[] = [];

  do {
    const json = await fetchSlackUsersPage(token, cursor);
    const page = parseSlackUsersResponse(json);
    users.push(...page.members);
    cursor = page.nextCursor;
  } while (cursor);

  return users;
}
