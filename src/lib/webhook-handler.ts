import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { getUsers } from "./cache";
import { getGitHubEvent } from "./github";
import { normalizePayload, type GitHubWebhookBody } from "./normalize";
import { PrState } from "./pr-state";
import { buildSlackUserMap } from "./user-mapping";
import { getConfig } from "./runtime-config";
import { getSlackBotToken, getKv } from "./secrets";
import { SlackBot } from "./slack-bot";
import type { NormalizedPayloadSuccess, PrMessageRecord } from "../types";

export { PrState };

export type Env = {
  PR_STATE: DurableObjectNamespace<PrState>;
};

function getPrStateStub(env: Env): PrState {
  return env.PR_STATE.get(env.PR_STATE.idFromName("global")) as unknown as PrState;
}

async function handleNewPr(
  bot: SlackBot,
  prState: PrState,
  payload: NormalizedPayloadSuccess,
  effectiveStatus: string,
  effectiveIsDraft: boolean,
): Promise<void> {
  const created = await bot.post({
    channel: payload.slackChannel,
    text: payload.mainMessageText,
    username: payload.githubUsername,
    icon_url: payload.githubAvatarUrl,
  });

  await bot.postThreadReply({
    threadReply: payload.threadReply,
    channel: payload.slackChannel,
    threadTs: created.ts,
    username: payload.githubUsername,
    iconUrl: payload.githubAvatarUrl,
  });

  await prState.upsertPrMessage({
    prKey: payload.prKey,
    slackTs: created.ts,
    slackChannel: created.channel,
    status: effectiveStatus,
    isDraft: effectiveIsDraft,
  });
}

async function handleExistingPrUpdate(
  bot: SlackBot,
  prState: PrState,
  payload: NormalizedPayloadSuccess,
  existing: PrMessageRecord,
  effectiveStatus: string,
  effectiveIsDraft: boolean,
): Promise<void> {
  await bot.update({
    channel: existing.slackChannel,
    ts: existing.slackTs,
    text: payload.mainMessageText,
  });

  await prState.upsertPrMessage({
    prKey: payload.prKey,
    slackTs: existing.slackTs,
    slackChannel: existing.slackChannel,
    status: effectiveStatus,
    isDraft: effectiveIsDraft,
  });
}

async function handleReviewSubmitted(
  bot: SlackBot,
  prState: PrState,
  payload: NormalizedPayloadSuccess,
  existing: PrMessageRecord,
  effectiveStatus: string,
  effectiveIsDraft: boolean,
): Promise<void> {
  await bot.update({
    channel: existing.slackChannel,
    ts: existing.slackTs,
    text: payload.mainMessageText,
  });

  await bot.postThreadReply({
    threadReply: payload.threadReply,
    channel: existing.slackChannel,
    threadTs: existing.slackTs,
    username: payload.githubUsername,
    iconUrl: payload.githubAvatarUrl,
  });

  await prState.upsertPrMessage({
    prKey: payload.prKey,
    slackTs: existing.slackTs,
    slackChannel: existing.slackChannel,
    status: effectiveStatus,
    isDraft: effectiveIsDraft,
  });
}

async function handleComment(
  bot: SlackBot,
  payload: NormalizedPayloadSuccess,
  existing: PrMessageRecord,
): Promise<void> {
  await bot.postThreadReply({
    threadReply: payload.threadReply,
    channel: existing.slackChannel,
    threadTs: existing.slackTs,
    username: payload.githubUsername,
    iconUrl: payload.githubAvatarUrl,
  });
}

export async function processWebhook(
  env: Env,
  rawBody: string,
  headers: globalThis.Headers,
): Promise<void> {
  const kv = getKv();
  const config = await getConfig(kv);
  const event = getGitHubEvent(headers);
  const body = JSON.parse(rawBody) as GitHubWebhookBody;
  const users = await getUsers(kv, getSlackBotToken());
  const slackIdMap = buildSlackUserMap(users);
  const payload = normalizePayload(event, body, slackIdMap, config);

  if (payload.skip) {
    return;
  }

  const bot = new SlackBot(getSlackBotToken());
  const prState = getPrStateStub(env);
  const existing = await prState.getPrMessage(payload.prKey);
  const effectiveStatus = payload.status ?? existing?.status ?? "opened";
  const effectiveIsDraft = payload.isDraft ?? existing?.isDraft ?? false;

  switch (payload.eventType) {
    case "pr_opened": {
      if (!existing) {
        await handleNewPr(bot, prState, payload, effectiveStatus, effectiveIsDraft);
      } else {
        await handleExistingPrUpdate(bot, prState, payload, existing, effectiveStatus, effectiveIsDraft);
      }
      return;
    }

    case "review_requested": {
      if (!existing) return;
      await handleExistingPrUpdate(bot, prState, payload, existing, effectiveStatus, effectiveIsDraft);
      return;
    }

    case "review_submitted": {
      if (!existing) return;
      await handleReviewSubmitted(bot, prState, payload, existing, effectiveStatus, effectiveIsDraft);
      return;
    }

    case "comment": {
      if (!existing) return;
      await handleComment(bot, payload, existing);
      return;
    }

    case "pr_closed": {
      if (!existing) return;
      await handleExistingPrUpdate(bot, prState, payload, existing, effectiveStatus, effectiveIsDraft);
      return;
    }
  }
}
