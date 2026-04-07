import type { KVNamespace } from "@cloudflare/workers-types";
import type { SlackUser } from "../types";
import { listUsers } from "./slack";

const CACHE_KEY = "slack:users:cache";
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 21600 seconds

export async function getUsers(
  kv: KVNamespace,
  slackToken: string,
): Promise<SlackUser[]> {
  const cached = await kv.get<SlackUser[]>(CACHE_KEY, "json");
  if (cached) {
    return cached;
  }

  const users = await listUsers(slackToken);

  await kv.put(CACHE_KEY, JSON.stringify(users), {
    expirationTtl: CACHE_TTL_SECONDS,
  });

  return users;
}

export async function clearCache(kv: KVNamespace): Promise<void> {
  await kv.delete(CACHE_KEY);
}
