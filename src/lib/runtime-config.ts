import type { KVNamespace } from "@cloudflare/workers-types";
import { SLACK_CHANNEL } from "../config/channels";
import { GITHUB_TO_SLACK_GROUP_MAP } from "../config/groups";
import { GITHUB_TO_SLACK_MAP } from "../config/users";
import type { RuntimeConfig } from "../types";

const CONFIG_KEY = "config:runtime";

const DEFAULT_CONFIG: RuntimeConfig = {
  slackChannel: SLACK_CHANNEL,
  githubToSlackMap: { ...GITHUB_TO_SLACK_MAP },
  githubToSlackGroupMap: { ...GITHUB_TO_SLACK_GROUP_MAP },
};

export async function getConfig(kv: KVNamespace): Promise<RuntimeConfig> {
  const cached = await kv.get<RuntimeConfig>(CONFIG_KEY, "json");

  if (cached) {
    return cached;
  }

  await kv.put(CONFIG_KEY, JSON.stringify(DEFAULT_CONFIG));
  return DEFAULT_CONFIG;
}

export async function putConfig(kv: KVNamespace, config: RuntimeConfig): Promise<void> {
  await kv.put(CONFIG_KEY, JSON.stringify(config));
}

export function getDefaultConfig(): RuntimeConfig {
  return {
    ...DEFAULT_CONFIG,
    githubToSlackMap: { ...DEFAULT_CONFIG.githubToSlackMap },
    githubToSlackGroupMap: Object.fromEntries(
      Object.entries(DEFAULT_CONFIG.githubToSlackGroupMap).map(([key, value]) => [
        key,
        [...value],
      ]),
    ),
  };
}
