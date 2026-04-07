import { Hono } from "hono";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { clearCache } from "./lib/cache";
import { verifySignature } from "./lib/github";
import { PrState } from "./lib/pr-state";
import { getConfig, putConfig } from "./lib/runtime-config";
import type { RuntimeConfig } from "./types";
import { getGithubWebhookSecret, isValidApiKey, getKv } from "./lib/secrets";
import { processWebhook } from "./lib/webhook-handler";

export { PrState };

export type Env = {
  PR_STATE: DurableObjectNamespace<PrState>;
};

const app = new Hono<{ Bindings: Env }>();

app.post("/github-pr-webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-hub-signature-256") ?? "";
  const isSignatureValid = await verifySignature(rawBody, signature, getGithubWebhookSecret());
  if (!isSignatureValid) {
    return c.json({ status: "unauthorized" }, 401);
  }
  c.executionCtx.waitUntil(processWebhook(c.env, rawBody, c.req.raw.headers));
  return c.json({ status: "ok" });
});

app.post("/clear-cache", async (c) => {
  if (!isValidApiKey(c.req)) return c.json({ status: "unauthorized" }, 401);
  await clearCache(getKv());
  return c.json({ status: "ok", message: "Slack users cache cleared" });
});

app.get("/config", async (c) => {
  if (!isValidApiKey(c.req)) return c.json({ status: "unauthorized" }, 401);
  return c.json(await getConfig(getKv()));
});

app.put("/config", async (c) => {
  if (!isValidApiKey(c.req)) return c.json({ status: "unauthorized" }, 401);
  const body = await c.req.json<RuntimeConfig>();
  if (!body.slackChannel || typeof body.slackChannel !== "string")
    return c.json({ error: "slackChannel is required" }, 400);
  if (!body.githubToSlackMap || typeof body.githubToSlackMap !== "object")
    return c.json({ error: "githubToSlackMap is required" }, 400);
  if (!body.githubToSlackGroupMap || typeof body.githubToSlackGroupMap !== "object")
    return c.json({ error: "githubToSlackGroupMap is required" }, 400);
  await putConfig(getKv(), body);
  return c.json({ status: "ok" });
});

app.patch("/config", async (c) => {
  if (!isValidApiKey(c.req)) return c.json({ status: "unauthorized" }, 401);
  const current = await getConfig(getKv());
  const patch = await c.req.json<Partial<RuntimeConfig>>();
  const updated: RuntimeConfig = {
    slackChannel: typeof patch.slackChannel === "string" ? patch.slackChannel : current.slackChannel,
    githubToSlackMap: patch.githubToSlackMap && typeof patch.githubToSlackMap === "object"
      ? { ...current.githubToSlackMap, ...patch.githubToSlackMap }
      : current.githubToSlackMap,
    githubToSlackGroupMap: patch.githubToSlackGroupMap && typeof patch.githubToSlackGroupMap === "object"
      ? { ...current.githubToSlackGroupMap, ...patch.githubToSlackGroupMap }
      : current.githubToSlackGroupMap,
  };
  await putConfig(getKv(), updated);
  return c.json(updated);
});

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
