import type * as sstType from "../.sst/platform/src/components/index"

declare const sst: typeof sstType

const kv = new sst.cloudflare.Kv("SlackUsersKv")

const githubWebhookSecret = new sst.Secret("GITHUB_WEBHOOK_SECRET")
const slackBotToken = new sst.Secret("SLACK_BOT_TOKEN")
const configApiKey = new sst.Secret("CONFIG_API_KEY")

new sst.cloudflare.Worker("GithubSlackNotifier", {
  handler: "src/index.ts",
  url: true,
  ...(process.env.CUSTOM_DOMAIN ? { domain: process.env.CUSTOM_DOMAIN } : {}),
  link: [kv, githubWebhookSecret, slackBotToken, configApiKey],
  build: {
    loader: {
      ".sql": "text",
    },
  },
  transform: {
    worker: (args) => {
      args.bindings = $resolve(args.bindings ?? []).apply((bindings) => [
        ...bindings,
        {
          type: "durable_object_namespace",
          name: "PR_STATE",
          className: "PrState",
        },
      ])

      args.migrations = $resolve(args.migrations ?? {}).apply((migrations) => ({
        ...migrations,
        oldTag: "v1",
        newTag: "v1",
      }))

      args.observability = $resolve(args.observability ?? {}).apply((observability) => ({
        ...observability,
        enabled: true,
        headSamplingRate: 1,
        logs: {
          enabled: true,
          headSamplingRate: 1,
          invocationLogs: true,
        },
      }))
    },
  },
})
