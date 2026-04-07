import { Resource } from "sst";
import type { KVNamespace } from "@cloudflare/workers-types";

type SstSecret = {
  value: string;
};

function getRequiredSecret(secretName: "SLACK_BOT_TOKEN" | "GITHUB_WEBHOOK_SECRET" | "CONFIG_API_KEY"): string {
  const secret = (Resource as unknown as Record<string, unknown>)[secretName];

  if (!secret || typeof secret !== "object") {
    throw new Error(`Missing SST secret: ${secretName}`);
  }

  const secretValue = (secret as SstSecret).value;
  if (typeof secretValue !== "string" || !secretValue) {
    throw new Error(`Invalid SST secret value: ${secretName}`);
  }

  return secretValue;
}

export function getKv(): KVNamespace {
  return (Resource as unknown as Record<string, unknown>).SlackUsersKv as KVNamespace;
}

let _slackBotToken: string | undefined;
let _githubWebhookSecret: string | undefined;
let _configApiKey: string | undefined;

export function getSlackBotToken(): string {
  _slackBotToken ??= getRequiredSecret("SLACK_BOT_TOKEN");
  return _slackBotToken;
}

export function getGithubWebhookSecret(): string {
  _githubWebhookSecret ??= getRequiredSecret("GITHUB_WEBHOOK_SECRET");
  return _githubWebhookSecret;
}

export function getConfigApiKey(): string {
  _configApiKey ??= getRequiredSecret("CONFIG_API_KEY");
  return _configApiKey;
}

export function isValidApiKey(request: { header: (name: string) => string | undefined }): boolean {
  const apiKey = request.header("x-api-key");
  return apiKey === getConfigApiKey();
}
