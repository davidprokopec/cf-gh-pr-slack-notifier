# github-slack-notifier

Rich Slack notifications for GitHub pull request activity. Deployed as a Cloudflare Worker with persistent PR state tracking via Durable Objects.

Posts a single Slack message per PR and keeps it updated as the PR progresses through reviews, approvals, and merges. Thread replies are added for descriptions, review comments, and inline comments.

## What it does

- Posts a Slack message when a PR is opened (or reopened / marked ready for review)
- Updates the message as the PR status changes (approved, changes requested, merged, closed, draft)
- Adds thread replies for PR descriptions, review comments, and issue comments
- Shows requested reviewers on the main message
- Maps GitHub usernames to Slack mentions via configurable user mapping
- Skips dependabot PRs and empty review comments
- Tracks PR state with Durable Objects so messages survive worker restarts

### Supported events

| GitHub event | What happens |
|---|---|
| PR opened / reopened / ready for review | Posts new message (or updates existing) |
| Review requested | Updates main message with reviewer list |
| Review submitted (approved / changes requested) | Updates status + thread reply with review body |
| Review comment | Thread reply with comment body |
| Issue comment on PR | Thread reply with comment body |
| PR merged | Updates status to MERGED |
| PR closed | Updates status to CLOSED |
| Converted to draft | Updates status to DRAFT |

### Message format

```
:large_yellow_circle: OPENED | repo-name - PR Title | @author
:eyes: Review requested @reviewer1, @reviewer2
```

Thread replies:

```
Description:
The PR description text...

:white_check_mark: Approved with comment by @reviewer:
LGTM, nice work!
View review
```

## Deploy Your Own

> **⚠️ Requires Cloudflare Workers Paid plan ($5/mo)** — Durable Objects (used for persistent PR state) are not available on the free tier. [See pricing](https://developers.cloudflare.com/workers/platform/pricing/).

Get your own instance running in minutes using GitHub's template feature and automated deployments.

### Step 1: Create your repository

Click the button below to create your own copy of this repository:

[![Use this template](https://img.shields.io/badge/Use%20this%20template-2ea44f?style=for-the-badge&logo=github)](https://github.com/new?template_name=github-slack-notifier&template_owner=YOUR_USERNAME)

Or go to this repo's main page and click **"Use this template"** → **"Create a new repository"**. This gives you a clean repo with no commit history that you own.

### Step 2: Create a Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **"Create Token"**
3. Use the **"Edit Cloudflare Workers"** template, or create a custom token with these permissions:
   - **Account** > Workers Scripts > **Edit**
   - **Account** > Workers KV Storage > **Edit**
   - **Account** > Workers R2 Storage > **Edit**
   - **Account** > Account Settings > **Read**
   - **Zone** > DNS > **Edit** (only if using a custom domain)
4. Copy the generated token

### Step 3: Set GitHub Secrets

In your new repository, go to **Settings > Secrets and variables > Actions > Secrets** and add:

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The API token from Step 2 |
| `CLOUDFLARE_DEFAULT_ACCOUNT_ID` | Your Cloudflare Account ID (found in your dashboard URL or [API overview](https://dash.cloudflare.com/profile/api-tokens)) |
| `SLACK_BOT_TOKEN` | Slack Bot OAuth Token (`xoxb-...`). See [Create a Slack app](#2-create-a-slack-app) below |
| `GITHUB_WEBHOOK_SECRET` | Random string for webhook verification. Generate with `openssl rand -hex 32` |
| `CONFIG_API_KEY` | API key for runtime config endpoints. Generate with `openssl rand -hex 32` |

### Step 4: Set custom domain (optional)

If you want to use your own domain instead of the default `*.workers.dev` URL, go to **Settings > Secrets and variables > Actions > Variables** and add:

| Variable | Description |
|---|---|
| `CUSTOM_DOMAIN` | Your custom domain (e.g. `pr-notifier.yourdomain.com`). Make sure DNS is configured to point to Cloudflare |

### Step 5: Deploy

Push to the `main` branch or trigger the workflow manually from the **Actions** tab. The first deploy will automatically create all required Cloudflare resources (Worker, KV namespace, Durable Object, R2 state bucket).

Find your worker URL in the GitHub Actions deploy log output.

### Step 6: Post-deploy setup

After the worker is deployed, complete the remaining setup:

1. **Create a Slack app** — Follow [Step 2: Create a Slack app](#2-create-a-slack-app) below
2. **Configure the GitHub webhook** — Follow [Step 7: Configure the GitHub webhook](#7-configure-the-github-webhook) below, using your worker URL from the deploy log
3. **Configure user mappings** — Use the [Runtime configuration API](#runtime-configuration-api) to set up your team's GitHub-to-Slack mappings and default channel

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [SST](https://sst.dev) v3 (Ion)
- A Slack Bot Token with `chat:write` and `users:list` scopes
- A GitHub webhook secret (any random string)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/github-slack-notifier.git
cd github-slack-notifier
bun install
```

### 2. Create a Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Under **OAuth & Permissions**, add these Bot Token Scopes:
   - `chat:write` — post and update messages
   - `users:list` — resolve Slack user IDs for mentions
3. Install the app to your workspace
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
5. Invite the bot to the channel where you want notifications (e.g. `/invite @your-bot-name` in the channel)

### 3. Configure user mappings

Edit `src/config/users.ts` to map GitHub usernames to Slack display names:

```ts
export const GITHUB_TO_SLACK_MAP: Record<string, string> = {
  "alice-github": "Alice Developer",
  "bob-github": "Bob Builder",
};
```

The values should match either the Slack **display name** or **username** of the person. The worker looks up their Slack user ID at runtime to create proper `@mentions`.

Edit `src/config/channels.ts` to set your default Slack channel:

```ts
export const SLACK_CHANNEL = "#pr-notifications";
```

Optionally, edit `src/config/groups.ts` to map GitHub teams to multiple Slack users:

```ts
export const GITHUB_TO_SLACK_GROUP_MAP: Record<string, string[]> = {
  "my-org/frontend-team": ["Alice Developer", "Bob Builder"],
};
```

### 4. Set SST secrets

```bash
# Set the Slack Bot Token
npx sst secret set SLACK_BOT_TOKEN xoxb-your-token-here

# Set a webhook secret (generate a random string)
npx sst secret set GITHUB_WEBHOOK_SECRET your-random-secret

# Set an API key for the config/cache management endpoints
npx sst secret set CONFIG_API_KEY your-api-key
```

### 5. Configure the domain (optional)

Edit `infra/app.ts` and change the `domain` to your own, or remove it to use the default Cloudflare Worker URL:

```ts
// Use your own domain
domain: `${$app.stage}.pr-notifier.yourdomain.com`,

// Or remove the line entirely to use the default *.workers.dev URL
```

### 6. Deploy

```bash
# Deploy to dev stage
bun run deploy:dev

# Deploy to production
bun run deploy
```

SST will output the worker URL. Note it for the next step.

### 7. Configure the GitHub webhook

1. Go to your GitHub repo (or org) **Settings > Webhooks > Add webhook**
2. Set the **Payload URL** to `https://your-worker-url/github-pr-webhook`
3. Set **Content type** to `application/json`
4. Set the **Secret** to the same value you used for `GITHUB_WEBHOOK_SECRET`
5. Under **Which events?**, select **Let me select individual events** and check:
   - Pull requests
   - Pull request reviews
   - Pull request review comments
   - Issue comments
6. Save the webhook

## Development

```bash
# Run SST dev mode (live reload on Cloudflare)
bun run dev

# Run tests
bun test

# Type check
bun run typecheck
```

## Runtime configuration API

The worker exposes a configuration API that lets you update user mappings and the Slack channel without redeploying. All endpoints require the `x-api-key` header set to your `CONFIG_API_KEY`.

### Get current config

```bash
curl -H "x-api-key: your-api-key" https://your-worker-url/config
```

### Replace config

```bash
curl -X PUT \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "slackChannel": "#pr-notifications",
    "githubToSlackMap": { "alice-github": "Alice Developer" },
    "githubToSlackGroupMap": {}
  }' \
  https://your-worker-url/config
```

### Patch config (merge)

```bash
curl -X PATCH \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "githubToSlackMap": { "new-user": "New Person" }
  }' \
  https://your-worker-url/config
```

### Clear Slack users cache

The worker caches the Slack user list in KV. If you add new people to your Slack workspace, clear the cache so they can be resolved:

```bash
curl -X POST \
  -H "x-api-key: your-api-key" \
  https://your-worker-url/clear-cache
```

## Project structure

```
src/
  index.ts                  # Hono routes and app entry point
  types.ts                  # Shared TypeScript types
  config/
    channels.ts             # Default Slack channel
    users.ts                # GitHub -> Slack user mapping
    groups.ts               # GitHub -> Slack group mapping
    status.ts               # Status emoji and text config
    messages.ts             # Message length limits
  db/
    schema.ts               # Drizzle schema for Durable Object SQLite
  lib/
    cache.ts                # Slack user list caching (KV)
    github.ts               # Webhook signature verification
    message-builder.ts      # Slack message text construction
    normalize.ts            # GitHub webhook payload normalization
    pr-state.ts             # Durable Object for PR state tracking
    runtime-config.ts       # Runtime config read/write (KV)
    secrets.ts              # SST secret access helpers
    slack.ts                # Slack API client
    user-mapping.ts         # GitHub -> Slack user resolution
    webhook-handler.ts      # Webhook processing orchestration
```

## Tech stack

- **[Hono](https://hono.dev)** — HTTP framework
- **[Cloudflare Workers](https://workers.cloudflare.com)** — serverless runtime
- **[Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)** — persistent PR state with SQLite
- **[Cloudflare KV](https://developers.cloudflare.com/kv/)** — Slack user cache and runtime config
- **[SST](https://sst.dev) v3** — infrastructure as code and deployment
- **[Drizzle ORM](https://orm.drizzle.team)** — type-safe SQLite access in Durable Objects
- **[Bun](https://bun.sh)** — runtime, package manager, and test runner

## License

[MIT](LICENSE)
